from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from src.core.database import engine
from src.core.utils import calculate_distance
from src.models.schemas import JoinClassRequest, SubmitAttendanceCode, UpdateProfileRequest
from src.core.security import require_student
from src import queries
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(tags=["student"])

@router.get("/api/student/classes")
async def get_enrolled_classes(student_id: int, current_user: dict = Depends(require_student)):
    # Ownership check: a student can only view their own classes
    if current_user["user_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        sql = text(
            """
                 SELECT c.class_id,
                     c.class_name,
                     c.join_code,
                     u.name as faculty_name,
                     ce.roll_number,
                     ce.section
            FROM class_enrollments ce
            JOIN classes c ON ce.class_id = c.class_id
            JOIN users u ON c.faculty_id = u.user_id
            WHERE ce.student_id = :student_id
            ORDER BY c.class_name
            """
        )
        async with engine.connect() as conn:
            result = await conn.execute(sql, {"student_id": student_id})
            return [dict(r._mapping) for r in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/student/classes/join")
async def join_class(join_data: JoinClassRequest, current_user: dict = Depends(require_student)):
    # Ownership check: a student can only join classes for themselves
    if current_user["user_id"] != join_data.student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        section_value = (join_data.section or "").strip() or None
        if section_value:
            section_value = section_value[:50]
        
        async with engine.begin() as conn:
            find_sql = text("SELECT class_id FROM classes WHERE join_code = :join_code")
            class_row = (await conn.execute(find_sql, {"join_code": join_data.join_code})).fetchone()
            
            if not class_row:
                raise HTTPException(status_code=404, detail="Invalid join code")
            class_id = class_row[0]
            
            check_enroll = text("SELECT 1 FROM class_enrollments WHERE student_id = :student_id AND class_id = :class_id")
            existing = (await conn.execute(check_enroll, {"student_id": join_data.student_id, "class_id": class_id})).fetchone()
            
            if existing:
                return {"message": "Already enrolled", "class_id": class_id}
            
            enroll_sql = text(
                """
                INSERT INTO class_enrollments (student_id, class_id, roll_number, section)
                VALUES (:student_id, :class_id, :roll_number, :section)
                """
            )
            await conn.execute(enroll_sql, {
                "student_id": join_data.student_id,
                "class_id": class_id,
                "roll_number": join_data.roll_number,
                "section": section_value
            })
            
            return {"message": "Successfully joined class", "class_id": class_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _submit_code_internal(payload: SubmitAttendanceCode):
    """Internal helper for attendance submission. Used by both the HTTP route and the SQS Lambda handler.
    Does NOT perform auth or cooldown checks — those are handled at the route level."""
    sql_session = text(
        """
        SELECT session_id, class_id, latitude, longitude, radius_meters
        FROM attendance_sessions
        WHERE generated_code = :code AND status = 'ACTIVE'
        LIMIT 1
        """
    )
    async with engine.begin() as conn:
        session = (await conn.execute(sql_session, {"code": payload.code})).fetchone()
        if not session:
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        
        session_id = session.session_id
        class_id = session.class_id
        session_lat = session.latitude
        session_lon = session.longitude
        radius_meters = session.radius_meters or 100  # Tightened default from 500m to 100m
        
        # Check enrollment
        sql_enroll = text("SELECT 1 FROM class_enrollments WHERE student_id = :sid AND class_id = :cid")
        if not (await conn.execute(sql_enroll, {"sid": payload.student_id, "cid": class_id})).fetchone():
            raise HTTPException(status_code=403, detail="Student not enrolled in this class")
        
        status = "PRESENT"
        distance = None
        location_message = ""
        
        if session_lat and session_lon:
            if payload.latitude and payload.longitude:
                distance = calculate_distance(
                    float(session_lat), float(session_lon),
                    payload.latitude, payload.longitude
                )
                student_accuracy = payload.accuracy or 0
                # Tightened accuracy buffer: cap at 50m (was 100m)
                accuracy_buffer = min(student_accuracy, 50)
                effective_radius = radius_meters + accuracy_buffer
                
                if distance > effective_radius:
                    status = "ABSENT"
                    location_message = f" - Outside zone (Distance: {distance:.0f}m, Allowed: {effective_radius:.0f}m)"
                else:
                    location_message = f" - Within zone ({distance:.0f}m)"
            else:
                raise HTTPException(status_code=400, detail="Location is required for this session.")
        
        # Upsert
        update_sql = text(
            """
            UPDATE attendance_records
            SET status = :status, marked_at = NOW()
            WHERE session_id = :ses AND student_id = :sid
            """
        )
        res = await conn.execute(update_sql, {"status": status, "ses": session_id, "sid": payload.student_id})
        if res.rowcount == 0:
            insert_sql = text(
                """
                INSERT INTO attendance_records (session_id, student_id, status, marked_at)
                VALUES (:ses, :sid, :status, NOW())
                """
            )
            await conn.execute(insert_sql, {"ses": session_id, "sid": payload.student_id, "status": status})
        
        class_sql = text("SELECT class_name, faculty_id FROM classes WHERE class_id = :cid")
        c_row = (await conn.execute(class_sql, {"cid": class_id})).fetchone()
        class_name = c_row.class_name

        return {
            "message": f"Attendance marked as {status}{location_message}",
            "session_id": session_id,
            "status": status,
            "distance": round(distance, 2) if distance else None,
            "within_radius": status == "PRESENT"
        }


@router.post("/attendance/submit-code")
async def submit_code(payload: SubmitAttendanceCode, current_user: dict = Depends(require_student)):
    # Ownership check: a student can only submit attendance for themselves
    if current_user["user_id"] != payload.student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        # ── Anti-spoofing: duplicate submission cooldown (60 seconds) ──
        async with engine.connect() as conn:
            cooldown_sql = text(
                """
                SELECT marked_at FROM attendance_records
                WHERE session_id IN (
                    SELECT session_id FROM attendance_sessions
                    WHERE generated_code = :code AND status = 'ACTIVE'
                )
                AND student_id = :sid
                ORDER BY marked_at DESC LIMIT 1
                """
            )
            last_record = (await conn.execute(cooldown_sql, {"code": payload.code, "sid": payload.student_id})).fetchone()
            if last_record and last_record.marked_at:
                time_since = datetime.utcnow() - last_record.marked_at
                if time_since < timedelta(seconds=60):
                    raise HTTPException(
                        status_code=429,
                        detail=f"Please wait {60 - int(time_since.total_seconds())} seconds before resubmitting."
                    )

        return await _submit_code_internal(payload)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[SUBMIT_CODE_ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/student/classes/{class_id}")
async def get_student_class_details(class_id: int, student_id: int, current_user: dict = Depends(require_student)):
    # Ownership check
    if current_user["user_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        sql = text(
            """
            SELECT
                c.class_id,
                c.class_name,
                c.faculty_id,
                u.name as faculty_name,
                NULL::text as attendance_mode,
                COALESCE(
                    (
                        SELECT COUNT(CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100
                        FROM attendance_sessions s2
                        LEFT JOIN attendance_records ar ON ar.session_id = s2.session_id AND ar.student_id = :student_id
                        WHERE s2.class_id = c.class_id
                        AND (s2.status != 'ACTIVE' OR ar.status IS NOT NULL)
                    ),
                    0
                ) as attendance_rate
            FROM classes c
            JOIN users u ON c.faculty_id = u.user_id
            WHERE c.class_id = :class_id
            """
        )
        async with engine.connect() as conn:
            row = (await conn.execute(sql, {"class_id": class_id, "student_id": student_id})).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Class not found")
            return dict(row._mapping)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/attendance-percentage")
async def attendance_percentage_student(student_id: int, current_user: dict = Depends(require_student)):
    # Ownership check
    if current_user["user_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await queries.get_attendance_percentage_for_student(student_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Student or records not found")
    return result

@router.get("/api/student/classes/{class_id}/attendance")
async def get_student_attendance_history(class_id: int, student_id: int, current_user: dict = Depends(require_student)):
    # Ownership check
    if current_user["user_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        sql = text(
            """
            SELECT 
                s.session_id, 
                s.start_time, 
                ar.status, 
                ar.marked_at
            FROM attendance_sessions s
            LEFT JOIN attendance_records ar ON s.session_id = ar.session_id AND ar.student_id = :student_id
            WHERE s.class_id = :class_id
            AND (s.status != 'ACTIVE' OR ar.status IS NOT NULL)
            ORDER BY s.start_time DESC
            """
        )
        async with engine.connect() as conn:
            result = await conn.execute(sql, {"class_id": class_id, "student_id": student_id})
            return [dict(r._mapping) for r in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/student/classes/{class_id}/leave")
async def leave_class(class_id: int, student_id: int, current_user: dict = Depends(require_student)):
    """Allow a student to leave (unenroll from) a class, removing their enrollment and attendance records."""
    if current_user["user_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        async with engine.begin() as conn:
            # Verify enrollment exists
            check_sql = text(
                "SELECT 1 FROM class_enrollments WHERE student_id = :student_id AND class_id = :class_id"
            )
            existing = (await conn.execute(check_sql, {"student_id": student_id, "class_id": class_id})).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Enrollment not found")

            # Delete attendance records for this student in this class
            delete_records_sql = text(
                """
                DELETE FROM attendance_records
                WHERE student_id = :student_id
                AND session_id IN (
                    SELECT session_id FROM attendance_sessions WHERE class_id = :class_id
                )
                """
            )
            await conn.execute(delete_records_sql, {"student_id": student_id, "class_id": class_id})

            # Delete the enrollment
            delete_enroll_sql = text(
                "DELETE FROM class_enrollments WHERE student_id = :student_id AND class_id = :class_id"
            )
            await conn.execute(delete_enroll_sql, {"student_id": student_id, "class_id": class_id})

        return {"message": "Successfully left the class", "class_id": class_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/student/profile")
async def update_profile(data: UpdateProfileRequest, current_user: dict = Depends(require_student)):
    """Update a student's name and/or email."""
    if current_user["user_id"] != data.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        name = data.name.strip()
        email = data.email.strip().lower()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Invalid email address")

        async with engine.begin() as conn:
            # Check email uniqueness (if changed)
            email_check_sql = text(
                "SELECT user_id FROM users WHERE email = :email AND user_id != :user_id"
            )
            conflict = (await conn.execute(email_check_sql, {"email": email, "user_id": data.user_id})).fetchone()
            if conflict:
                raise HTTPException(status_code=409, detail="Email is already in use by another account")

            update_sql = text(
                "UPDATE users SET name = :name, email = :email WHERE user_id = :user_id"
            )
            await conn.execute(update_sql, {"name": name, "email": email, "user_id": data.user_id})

        return {"message": "Profile updated successfully", "name": name, "email": email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))