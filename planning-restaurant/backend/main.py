"""FastAPI server for planning solver."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import SolverRequest, SolverResponse
from solver import solve_planning

app = FastAPI(title="Planning Restaurant Solver", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "solver": "CP-SAT"}


@app.post("/solve", response_model=SolverResponse)
def solve(req: SolverRequest):
    return solve_planning(req)
