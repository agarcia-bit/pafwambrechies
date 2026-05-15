"""FastAPI server for planning solver."""
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import SolverRequest, SolverResponse
from solver import solve_planning
from kitchen_solver import solve_kitchen

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("solver")

app = FastAPI(title="Planning Restaurant Solver", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://planning-restaurant.netlify.app",
    "https://lecap-planning.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def validate_request(req: SolverRequest):
    if not req.employees:
        raise HTTPException(status_code=400, detail="Aucun salarié fourni")
    if not req.shift_templates:
        raise HTTPException(status_code=400, detail="Aucun créneau horaire fourni")
    if req.productivity_target <= 0:
        raise HTTPException(status_code=400, detail="productivity_target doit être > 0")
    if req.max_working_days < 1 or req.max_working_days > 7:
        raise HTTPException(status_code=400, detail="max_working_days doit être entre 1 et 7")
    if req.min_rest_hours < 0 or req.min_rest_hours > 24:
        raise HTTPException(status_code=400, detail="min_rest_hours doit être entre 0 et 24")


@app.get("/health")
def health():
    return {"status": "ok", "solver": "CP-SAT"}


@app.post("/solve", response_model=SolverResponse)
def solve(req: SolverRequest):
    validate_request(req)
    salle = [e for e in req.employees if e.department == "salle" and not e.is_manager]
    if not salle:
        return SolverResponse(success=True, entries=[], status="NO_SALLE", warnings=["Aucun salarié salle (hors managers)"])
    logger.info("Solve salle: %d employees, %d shifts, week=%s", len(salle), len(req.shift_templates), req.week_start_date)
    result = solve_planning(req)
    logger.info("Solve salle done: %s in %dms", result.status, result.solve_time_ms)
    return result


@app.post("/solve-kitchen", response_model=SolverResponse)
def solve_kitchen_endpoint(req: SolverRequest):
    validate_request(req)
    logger.info("Solve kitchen: %d employees, week=%s", len([e for e in req.employees if e.department == "cuisine"]), req.week_start_date)
    result = solve_kitchen(req)
    logger.info("Solve kitchen done: %s in %dms", result.status, result.solve_time_ms)
    return result
