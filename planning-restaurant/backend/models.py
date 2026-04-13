"""Data models for the planning solver API."""
from __future__ import annotations
from typing import Optional, List, Dict
from pydantic import BaseModel


class ShiftTemplate(BaseModel):
    id: str
    code: str
    start_time: float
    end_time: float
    effective_hours: float
    meals: int = 0
    baskets: int = 0
    applicability: str


class Employee(BaseModel):
    id: str
    first_name: str
    weekly_hours: float
    modulation_range: float = 5
    is_manager: bool = False
    role_id: str = ""


class ManagerSchedule(BaseModel):
    employee_id: str
    day_of_week: int
    shift_template_id: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None


class Unavailability(BaseModel):
    employee_id: str
    type: str
    day_of_week: Optional[int] = None
    specific_date: Optional[str] = None
    available_from: Optional[float] = None
    available_until: Optional[float] = None


class ConditionalAvailability(BaseModel):
    employee_id: str
    day_of_week: int
    allowed_shift_codes: List[str]
    max_hours: Optional[float] = None


class DayForecast(BaseModel):
    day_of_week: int
    forecasted_revenue: float


class EventOverride(BaseModel):
    day_of_week: int
    revenue_multiplier_percent: float


class SolverRequest(BaseModel):
    week_start_date: str
    employees: List[Employee]
    shift_templates: List[ShiftTemplate]
    manager_schedules: List[ManagerSchedule] = []
    unavailabilities: List[Unavailability] = []
    conditional_availabilities: List[ConditionalAvailability] = []
    day_forecasts: List[DayForecast] = []
    event_overrides: List[EventOverride] = []
    employee_roles: Dict[str, str] = {}
    closing_time_week: float = 24.0
    closing_time_sunday: float = 21.0
    productivity_target: float = 95.0


class ShiftAssignment(BaseModel):
    employee_id: str
    day_of_week: int
    shift_template_id: str
    start_time: float
    end_time: float
    effective_hours: float
    meals: int
    baskets: int


class SolverResponse(BaseModel):
    success: bool
    entries: List[ShiftAssignment] = []
    status: str = ""
    solve_time_ms: int = 0
    warnings: List[str] = []
