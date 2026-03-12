# AWS Deployment Options: Complete Comparison Guide

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Understanding AWS Services](#understanding-aws-services)
3. [EC2 vs Lambda: Detailed Comparison](#ec2-vs-lambda-detailed-comparison)
4. [Supporting Services Explained](#supporting-services-explained)
5. [Architecture Diagrams](#architecture-diagrams)
6. [Cost Analysis for 1000+ Users](#cost-analysis-for-1000-users)
7. [Recommendation for AttendX](#recommendation-for-attendx)
8. [Deployment Instructions](#deployment-instructions)

---

## Executive Summary

| Factor | Lambda (Serverless) | EC2 (Server-based) |
|--------|---------------------|---------------------|
| **Best For** | Variable/bursty traffic | Constant high traffic 24/7 |
| **Scaling** | Automatic, instant | Manual or Auto Scaling Groups |
| **Management** | Zero server management | Full server responsibility |
| **Cost Model** | Pay per request | Pay per hour (running or not) |
| **Cold Start** | 1-3 seconds on first request | Always warm |
| **Max Execution** | 15 minutes per request | Unlimited |
| **Recommended for AttendX** | ✅ Yes | ❌ Overkill |

---

## Understanding AWS Services

### What Each Service Does (Simple Explanation)

#### Compute Services (Where Your Code Runs)

| Service | What It Is | Simple Analogy |
|---------|-----------|----------------|
| **EC2** | Virtual server you fully control | Renting an apartment - you pay rent whether you're home or not |
| **Lambda** | Code that runs only when needed | Paying for electricity - only pay when lights are on |
| **ECS/Fargate** | Docker containers managed by AWS | Renting a furnished apartment - less setup needed |

#### Networking & Traffic Services

| Service | What It Is | Why You Need It |
|---------|-----------|-----------------|
| **API Gateway** | Front door for your API | Routes requests, handles auth, rate limiting, CORS |
| **CloudFront** | CDN (Content Delivery Network) | Serves frontend files fast from 400+ global locations |
| **Route 53** | DNS service | Maps your domain (attendx.com) to AWS resources |
| **Load Balancer (ALB)** | Distributes traffic across servers | Only needed with EC2 to balance load across instances |

#### Database Services

| Service | What It Is | Best For |
|---------|-----------|----------|
| **RDS** | Managed PostgreSQL/MySQL | Production databases with auto-backups |
| **Aurora Serverless** | Auto-scaling database | Variable database usage |
| **ElastiCache** | Redis/Memcached caching | Session storage, caching frequent queries |

#### Queue & Async Services

| Service | What It Is | When You Need It |
|---------|-----------|------------------|
| **SQS** | Message queue | Async tasks (emails, notifications) |
| **SNS** | Push notifications | Mobile push, SMS, email broadcasts |
| **EventBridge** | Event routing | Scheduled tasks, event-driven workflows |

---

## EC2 vs Lambda: Detailed Comparison

### 1. How They Work

#### Lambda (Serverless)
```
User Request → API Gateway → Lambda Function → Response
                    ↓
              (Auto-creates instances as needed)
              (Scales to 1000s automatically)
              (Shuts down when idle - $0)
```

**Your code lifecycle:**
1. User makes request
2. AWS spins up a container with your code (cold start: 1-3s)
3. Code executes (you pay for this time)
4. Container stays warm for ~15 min
5. Next request reuses warm container (fast)
6. After idle, container is destroyed

#### EC2 (Traditional Server)
```
User Request → Load Balancer → EC2 Instance(s) → Response
                                    ↓
                            (Always running)
                            (You manage scaling)
                            (Paying 24/7)
```

**Your code lifecycle:**
1. Server runs 24/7 with uvicorn/gunicorn
2. All requests handled by always-on server
3. You manage: OS updates, security patches, scaling
4. Pay whether users are active or not

---

### 2. Scaling Behavior

#### Lambda Auto-Scaling
```
Time        Users    Lambda Instances    Cost
─────────────────────────────────────────────────
2:00 AM     5        1                   $0.001
8:00 AM     200      20                  $0.02
9:00 AM     1000     100                 $0.10   ← Class check-in rush
9:30 AM     50       5                   $0.005
11:00 PM    0        0                   $0.00   ← Zero cost when idle
```

#### EC2 Auto-Scaling (requires configuration)
```
Time        Users    EC2 Instances       Cost
─────────────────────────────────────────────────
2:00 AM     5        2 (minimum)         $0.08/hr
8:00 AM     200      2                   $0.08/hr
9:00 AM     1000     4 (scaled up)       $0.16/hr  ← Takes 2-5 min to scale
9:30 AM     50       4 (cooldown)        $0.16/hr  ← Still paying for 4
11:00 PM    0        2 (minimum)         $0.08/hr  ← Still paying
```

---

### 3. Cold Start Problem (Lambda)

**What is it?** When Lambda hasn't been used recently, AWS needs to:
1. Download your code package
2. Start a container
3. Initialize your Python runtime
4. Load your FastAPI app

**Impact on AttendX:**
| Scenario | Cold Start? | User Experience |
|----------|-------------|-----------------|
| First request of the day | Yes (2-3s delay) | Slight wait |
| 1000 students all checking in | First few: Yes, rest: No | Most get fast response |
| Continuous usage during class | No (warm) | Fast |

**Solutions:**
1. **Provisioned Concurrency** - Keep N instances warm ($$$)
2. **CloudWatch scheduled ping** - Ping every 5 min to keep warm (free)
3. **Accept it** - 2-3s on first request is acceptable for most apps

---

### 4. When to Choose Each

#### Choose Lambda When:
- ✅ Traffic is variable/bursty (attendance systems!)
- ✅ You want zero server management
- ✅ Budget is limited (pay per use)
- ✅ Requests complete in <15 minutes
- ✅ You're a small team without DevOps expertise

#### Choose EC2 When:
- ✅ Constant high traffic 24/7 (streaming service)
- ✅ Long-running processes (video encoding)
- ✅ Need specific OS configurations
- ✅ WebSocket connections (real-time chat)
- ✅ Predictable costs are preferred over variable

---

## Supporting Services Explained

### API Gateway: Do You Need It?

#### What API Gateway Does:
1. **Routes requests** to your Lambda function
2. **Authentication** - Validate JWT tokens at the edge
3. **Rate limiting** - Prevent abuse (1000 req/sec per user)
4. **CORS handling** - Already configured in your template.yaml
5. **Request validation** - Reject malformed requests before Lambda
6. **Caching** - Cache GET responses (reduce Lambda calls)
7. **Custom domains** - api.attendx.com instead of ugly AWS URL

#### For Lambda: **Required**
```
Without API Gateway:
User → ??? → Lambda (no way to reach it via HTTP)

With API Gateway:
User → API Gateway → Lambda ✓
```

#### For EC2: **Optional** (use Load Balancer instead)
```
Without API Gateway:
User → Load Balancer → EC2 ✓

With API Gateway:
User → API Gateway → Load Balancer → EC2 (extra hop, extra cost)
```

#### API Gateway Types:

| Type | Cost | Features | Best For |
|------|------|----------|----------|
| **HTTP API** | $1.00/million requests | Basic routing, CORS, JWT auth | Most APIs (use this) |
| **REST API** | $3.50/million requests | Caching, request validation, API keys | Enterprise APIs |
| **WebSocket API** | $1.00/million messages | Real-time bidirectional | Chat, live updates |

**Recommendation for AttendX:** HTTP API (cheapest, sufficient features)

---

### SQS Queue: Do You Need It?

#### What SQS Does:
SQS (Simple Queue Service) handles **async tasks** - things that don't need immediate response.

```
Without Queue (Synchronous):
User clicks "Submit Attendance"
    → Lambda validates
    → Lambda saves to DB
    → Lambda sends email notification  ← User waits for this!
    → Lambda returns response
Total wait: 3-5 seconds

With Queue (Asynchronous):
User clicks "Submit Attendance"
    → Lambda validates
    → Lambda saves to DB
    → Lambda queues email task  ← Instant
    → Lambda returns response
Total wait: 0.5 seconds

Meanwhile (background):
    Queue → Email Worker Lambda → Sends email
```

#### Your Current Setup Has SQS:
```yaml
# From your template.yaml
NotificationQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: "attendance-notifications-queue"
```

#### When You Need SQS:

| Task | Need Queue? | Why |
|------|-------------|-----|
| Sending email notifications | ✅ Yes | Don't make user wait for SMTP |
| Generating attendance reports | ✅ Yes | PDF generation is slow |
| Saving attendance record | ❌ No | Fast DB operation, user needs confirmation |
| Login/Auth | ❌ No | Must be synchronous |
| Real-time attendance code validation | ❌ No | User needs instant feedback |

#### For AttendX:
**Recommended for:**
- Password reset emails
- Attendance confirmation emails
- Weekly attendance report generation
- Bulk notifications to all students

**Not needed for:**
- Attendance marking (direct DB write is fine)
- Login/logout
- Fetching dashboard data

---

### Other Services: Do You Need Them?

| Service | Need for AttendX? | Why/Why Not |
|---------|-------------------|-------------|
| **CloudFront** | ✅ Yes | Serve React frontend globally, fast |
| **S3** | ✅ Yes | Host frontend static files |
| **RDS** | ✅ Yes | Managed PostgreSQL database |
| **Route 53** | ⚡ Optional | Only if you want custom domain |
| **ElastiCache (Redis)** | ❌ No | Overkill for 1000 users |
| **Cognito** | ❌ No | You have custom auth already |
| **WAF** | ⚡ Optional | Web firewall, nice for security |
| **CloudWatch** | ✅ Yes (included) | Logs and monitoring |

---

## Architecture Diagrams

### Option 1: Lambda Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAMBDA ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    USERS (1000+)                                                             │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         CLOUDFRONT CDN                               │    │
│  │              (Caches static files at 400+ edge locations)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                          │                         │
│         ▼                                          ▼                         │
│  ┌─────────────────┐                    ┌─────────────────────┐             │
│  │    S3 BUCKET    │                    │    API GATEWAY      │             │
│  │  (React Build)  │                    │    (HTTP API)       │             │
│  │                 │                    │                     │             │
│  │  - index.html   │                    │  - /api/auth/*      │             │
│  │  - assets/*     │                    │  - /api/faculty/*   │             │
│  │  - static/*     │                    │  - /api/student/*   │             │
│  └─────────────────┘                    └──────────┬──────────┘             │
│                                                    │                         │
│                                                    ▼                         │
│                                         ┌─────────────────────┐             │
│                                         │   LAMBDA FUNCTION   │             │
│                                         │   (FastAPI + Mangum)│             │
│                                         │                     │             │
│                                         │  Auto-scales:       │             │
│                                         │  1 → 1000 instances │             │
│                                         └──────────┬──────────┘             │
│                                                    │                         │
│                          ┌─────────────────────────┼─────────────────────┐  │
│                          │                         │                     │  │
│                          ▼                         ▼                     ▼  │
│               ┌─────────────────┐      ┌─────────────────┐    ┌──────────┐ │
│               │   RDS POSTGRES  │      │   SQS QUEUE     │    │   SES    │ │
│               │   (Database)    │      │  (Async Tasks)  │    │ (Emails) │ │
│               │                 │      │                 │    │          │ │
│               │  - Users        │      │  - Email jobs   │    │  SMTP    │ │
│               │  - Attendance   │      │  - Reports      │    │ Service  │ │
│               │  - Classes      │      │                 │    │          │ │
│               └─────────────────┘      └────────┬────────┘    └──────────┘ │
│                                                 │                          │
│                                                 ▼                          │
│                                      ┌─────────────────────┐               │
│                                      │  WORKER LAMBDA      │               │
│                                      │  (Process Queue)    │               │
│                                      └─────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Option 2: EC2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EC2 ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    USERS (1000+)                                                             │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         CLOUDFRONT CDN                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                          │                         │
│         ▼                                          ▼                         │
│  ┌─────────────────┐                    ┌─────────────────────┐             │
│  │    S3 BUCKET    │                    │  APPLICATION LOAD   │             │
│  │  (React Build)  │                    │     BALANCER        │             │
│  └─────────────────┘                    └──────────┬──────────┘             │
│                                                    │                         │
│                                    ┌───────────────┼───────────────┐        │
│                                    │               │               │        │
│                                    ▼               ▼               ▼        │
│                              ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│                              │   EC2    │   │   EC2    │   │   EC2    │    │
│                              │ Instance │   │ Instance │   │ Instance │    │
│                              │    #1    │   │    #2    │   │    #3    │    │
│                              │          │   │          │   │          │    │
│                              │ Uvicorn  │   │ Uvicorn  │   │ Uvicorn  │    │
│                              │ + Nginx  │   │ + Nginx  │   │ + Nginx  │    │
│                              └────┬─────┘   └────┬─────┘   └────┬─────┘    │
│                                   │              │              │           │
│                                   └──────────────┼──────────────┘           │
│                                                  │                          │
│                              ┌───────────────────┼───────────────────┐     │
│                              │                   │                   │     │
│                              ▼                   ▼                   ▼     │
│                   ┌─────────────────┐    ┌─────────────┐    ┌───────────┐ │
│                   │  RDS POSTGRES   │    │ ELASTICACHE │    │    SQS    │ │
│                   │  (Database)     │    │   (Redis)   │    │  (Queue)  │ │
│                   └─────────────────┘    └─────────────┘    └───────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                      AUTO SCALING GROUP                               │ │
│  │   Min: 2 instances | Max: 5 instances | Target: 70% CPU              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Analysis for 1000+ Users

### Assumptions:
- 1000 daily active users
- 5000 API requests per day average
- 20,000 requests on peak days (attendance rush)
- Database: 10GB storage

### Lambda Architecture Costs

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **Lambda** | 150,000 requests × 500ms avg | $0 (free tier: 1M requests) |
| **API Gateway (HTTP)** | 150,000 requests | $0.15 |
| **S3** | 50MB static files + 100GB transfer | $2.50 |
| **CloudFront** | 100GB transfer | $8.50 |
| **RDS db.t3.micro** | 10GB storage | $15.00 |
| **SQS** | 50,000 messages | $0 (free tier: 1M) |
| **CloudWatch** | Basic logging | $0 (free tier) |
| **Route 53** | 1 hosted zone | $0.50 |
| | | |
| **TOTAL** | | **~$27/month** |

### EC2 Architecture Costs

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **EC2 t3.medium** (2 instances min) | 24/7 running | $60.00 |
| **Application Load Balancer** | Always on | $16.00 |
| **S3** | 50MB static files | $0.50 |
| **CloudFront** | 100GB transfer | $8.50 |
| **RDS db.t3.micro** | 10GB storage | $15.00 |
| **ElastiCache** | Redis t3.micro | $12.00 |
| **CloudWatch** | Enhanced monitoring | $3.00 |
| **Route 53** | 1 hosted zone | $0.50 |
| | | |
| **TOTAL** | | **~$116/month** |

### Cost Comparison Summary

```
Monthly Cost Comparison
═══════════════════════════════════════════════════

Lambda:  $27   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░
EC2:     $116  ██████████████████████████████████░

Annual Savings with Lambda: ~$1,068
```

---

## Recommendation for AttendX

### Why Lambda is Better for Your App

1. **Traffic Pattern Match**
   ```
   AttendX Usage Pattern:
   
   6 AM  ░░░░░░░░░░ (no users)
   9 AM  ██████████████████████████████ (class check-in rush)
   10 AM ████████░░░░░░░░░░░░░░░░░░░░░░ (steady)
   2 PM  ██████████████████████████████ (afternoon rush)
   6 PM  ████░░░░░░░░░░░░░░░░░░░░░░░░░░ (low)
   11 PM ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (zero)
   
   → Lambda: Pay only during peaks
   → EC2: Pay 24/7 even at 0 usage
   ```

2. **Already Configured**
   - Your `main.py` has Mangum handler ✓
   - Your `template.yaml` is SAM-ready ✓
   - Just deploy, no code changes needed

3. **Management Overhead**
   - Lambda: Deploy and forget
   - EC2: OS updates, security patches, nginx config, SSL renewal

4. **Scaling**
   - Lambda: 1000 students rush to check in? Auto-handled.
   - EC2: Need to pre-configure Auto Scaling Groups

### Final Recommendation

```
┌────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED ARCHITECTURE                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Frontend:  S3 + CloudFront (static hosting)                  │
│   Backend:   Lambda + API Gateway (HTTP API)                   │
│   Database:  RDS PostgreSQL (or Supabase free tier)            │
│   Queue:     SQS (for email notifications)                     │
│   Domain:    Route 53 (optional)                               │
│                                                                 │
│   Estimated Cost: $25-50/month for 1000+ users                 │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Deployment Instructions

### Step 1: Prerequisites

```powershell
# Install AWS CLI
winget install Amazon.AWSCLI

# Install SAM CLI
winget install Amazon.SAM-CLI

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-south-1 for India)
```

### Step 2: Deploy Backend (Lambda)

```powershell
cd attendance_backend

# Build the application
sam build

# Deploy (first time - interactive)
sam deploy --guided

# Answer prompts:
# Stack Name: attendx-backend
# Region: ap-south-1 (or your preferred)
# Confirm changes: Y
# Allow SAM CLI IAM role creation: Y
# Save arguments to samconfig.toml: Y
```

### Step 3: Deploy Frontend (S3 + CloudFront)

```powershell
cd frontend

# Build production bundle
npm run build

# Create S3 bucket
aws s3 mb s3://attendx-frontend-prod

# Upload build files
aws s3 sync dist/ s3://attendx-frontend-prod --delete

# Enable static website hosting
aws s3 website s3://attendx-frontend-prod --index-document index.html --error-document index.html
```

### Step 4: Create CloudFront Distribution

```powershell
# Create CloudFront distribution (via AWS Console is easier)
# Or use this CLI command:

aws cloudfront create-distribution \
    --origin-domain-name attendx-frontend-prod.s3.amazonaws.com \
    --default-root-object index.html
```

### Step 5: Update Environment Variables

After deployment, update your frontend `.env`:
```
VITE_API_URL=https://your-api-id.execute-api.ap-south-1.amazonaws.com
```

---

## Quick Reference: Service Cheat Sheet

| Question | Answer |
|----------|--------|
| Do I need API Gateway? | **Yes** (required for Lambda) |
| Do I need Load Balancer? | **No** (only for EC2) |
| Do I need SQS? | **Yes** (for async emails/notifications) |
| Do I need CloudFront? | **Yes** (fast frontend delivery) |
| Do I need ElastiCache? | **No** (overkill for 1000 users) |
| Do I need Route 53? | **Optional** (only for custom domain) |
| Which database? | **RDS PostgreSQL** or Supabase |
| Lambda or EC2? | **Lambda** (cheaper, auto-scaling, zero management) |

---

## Troubleshooting

### Lambda Cold Start Too Slow?
```yaml
# Add to template.yaml under your function:
ProvisionedConcurrencyConfig:
  ProvisionedConcurrentExecutions: 2
```
Cost: ~$15/month for 2 warm instances

### Database Connection Pooling
Lambda creates new connections per invocation. Use RDS Proxy:
```yaml
# Add RDS Proxy to avoid connection exhaustion
# Cost: ~$20/month
```

### CORS Issues
Your `template.yaml` already handles CORS. If issues persist, check API Gateway settings.

---

*Document created for AttendX - Faculty Student Hub*
*Last updated: March 2026*
