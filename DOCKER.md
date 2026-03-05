# Docker Setup Guide for Tradeflow

## Quick Start

### 1. Start all services
```bash
cd tradeflow
docker-compose up -d
```

### 2. Check logs
```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# View postgres logs only
docker-compose logs -f postgres
```

### 3. Stop all services
```bash
docker-compose down
```

### 4. Stop and remove volumes (clean slate)
```bash
docker-compose down -v
```

## Troubleshooting

### Migration Issues

If migrations fail, check the backend logs:
```bash
docker-compose logs backend
```

### Rebuild containers
If you make changes to the code:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Run migrations manually
```bash
docker-compose exec backend node src/db/migrate.js
```

### Access PostgreSQL directly
```bash
docker-compose exec postgres psql -U postgres -d o2c_db
```

### Check database connection
```bash
docker-compose exec backend nc -zv postgres 5432
```

## Environment Variables

Edit `docker-compose.yml` to change:
- `POSTGRES_PASSWORD`: Database password
- `DB_PASSWORD`: Must match POSTGRES_PASSWORD
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: Backend port (default: 3000)

## Services

- **PostgreSQL**: `localhost:5432`
- **Backend API**: `localhost:3000`
- **Frontend**: `localhost:80`

## Health Checks

The backend waits for PostgreSQL to be healthy before starting.
You can check service health:
```bash
docker-compose ps
```

## Common Issues

### 1. Port already in use
If port 5432, 3000, or 80 is already in use:
```bash
# Stop the conflicting service or change ports in docker-compose.yml
```

### 2. Permission denied on start.sh
```bash
chmod +x start.sh
docker-compose build --no-cache
```

### 3. Database connection refused
```bash
# Check if postgres is running
docker-compose ps postgres

# Restart postgres
docker-compose restart postgres
```

### 4. Migrations not running
```bash
# Run migrations manually
docker-compose exec backend node src/db/migrate.js
```
