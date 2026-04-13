"""Data models for the planning solver API."""
from pydantic import BaseModel


class ShiftTemplate(BaseModel):
    id: str
    code: str
    start_time: float  # decimal hours (9.5 = 9h30)
    end_time: float
    effective_hours: float
    meals: int = 0
    baskets: int = 0
    applicability: str  # 'tue_sat' | 'sat_only' | 'sunday'


class Employee(BaseModel):
    id: str
    first_name: str
    weekly_hours: float
    modulation_range: float = 5
    is_manager: bool = False
    role_id: str = ""


class ManagerSchedule(BaseModel):
    employee_id: str
    day_of_week: int  # 0=lundi..6=dimanche
    shift_template_id: str | None = None  # None = OFF
    start_time: float | None = None
    end_time: float | None = None


class Unavailability(BaseModel):
    employee_id: str
    type: str  # 'fixed' | 'punctual'
    day_of_week: int | None = None
    specific_date: str | None = None
    available_from: float | None = None
    available_until: float | None = None


class ConditionalAvailability(BaseModel):
    employee_id: str
    day_of_week: int
    allowed_shift_codes: list[str]
    max_hours: float | None = None


class DayForecast(BaseModel):
    day_of_week: int
    forecasted_revenue: float


class EventOverride(BaseModel):
    day_of_week: int
    revenue_multiplier_percent: float


class SolverRequest(BaseModel):
    week_start_date: str
    employees: list[Employee]
    shift_templates: list[ShiftTemplate]
    manager_schedules: list[ManagerSchedule] = []
    unavailabilities: list[Unavailability] = []
    conditional_availabilities: list[ConditionalAvailability] = []
    day_forecasts: list[DayForecast] = []
    event_overrides: list[EventOverride] = []
    employee_roles: dict[str, str] = {}  # employee_id -> role_id
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
    entries: list[ShiftAssignment] = []
    status: str = ""  # 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE'
    solve_time_ms: int = 0
    warnings: list[str] = []
