FROM public.ecr.aws/lambda/python:3.12

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy only pyproject configuration to the Lambda Task Root
COPY pyproject.toml uv.lock ./

# Export dependencies from the lockfile and install them efficiently using uv
RUN uv export > req.txt && uv pip install --system --no-cache -r req.txt && rm req.txt

# Copy app code to the Lambda Task Root
COPY . ${LAMBDA_TASK_ROOT}

# Start the handler
CMD ["main.handler"]