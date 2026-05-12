import os
import math
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel
import pandas as pd
from catboost import CatBoostClassifier

# Creación del app de FastAPI
app = FastAPI(
    title="AI DevOps Microservice",
    description="Microservicio de IA para predicción de riesgo y análisis semántico de logs.",
    version="1.0.0"
)

# Configuración estricta de CORS para Vue.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialización de OpenAI
load_dotenv()
try:
    client = OpenAI()
    ai_status = "Conectado a OpenAI"
except Exception as e:
    client = None
    ai_status = "Desconectado (Falta API Key válida en .env)"

# CARGA DEL MODELO MACHINE LEARNING (CatBoost v3)
# Leer rutas de modelo desde variables de entorno para flexibilidad en CI/producción.
# Por defecto se mantiene el comportamiento anterior (archivo en el directorio del servicio).
MODEL_PATH_V3 = os.getenv("CATBOOST_V3_PATH", "catboost_despliegues_v3.cbm")
MODEL_PATH_LEGACY = os.getenv("CATBOOST_LEGACY_PATH", "catboost_despliegues.cbm")

modelo_riesgo = None
model_version = "unknown"
ml_status = "Modelo no cargado"
try:
    if os.path.exists(MODEL_PATH_V3):
        modelo_riesgo = CatBoostClassifier()
        modelo_riesgo.load_model(MODEL_PATH_V3)
        model_version = "catboost_v3"
        ml_status = f"Modelo CatBoost v3 cargado desde: {MODEL_PATH_V3}"
    elif os.path.exists(MODEL_PATH_LEGACY):
        modelo_riesgo = CatBoostClassifier()
        modelo_riesgo.load_model(MODEL_PATH_LEGACY)
        model_version = "catboost_legacy"
        ml_status = f"Modelo CatBoost legacy cargado desde: {MODEL_PATH_LEGACY}"
    else:
        ml_status = f"Desconectado (No existe {MODEL_PATH_V3} ni {MODEL_PATH_LEGACY})"
except Exception as e:
    ml_status = f"Error cargando modelo: {str(e)}"

MODEL_COLUMNS = [
    "branch",
    "event_type",
    "commit_action",
    "commit_scope",
    "files_changed",
    "lines_added",
    "lines_deleted",
    "lines_changed",
    "dia_semana",
    "hora_dia",
    "is_weekend",
    "is_hotfix_branch",
    "is_feature_branch",
    "is_main_branch",
    "has_docker_change",
    "has_db_change",
    "has_api_change",
    "has_frontend_change",
    "has_login_change",
    "has_dependency_change",
    "has_env_change",
    "has_migration_change",
    "lines_per_file",
    "lines_changed_log",
    "files_changed_log",
    "after_hours",
    "work_hours",
    "high_change",
    "very_high_change",
    "many_files_changed",
    "critical_component_change",
    "critical_high_change",
    "hotfix_high_change",
    "main_push",
    "weekend_after_hours",
]


class LogAnalysisRequest(BaseModel):
    error_log: str
    repository: str


class RiskPredictionRequest(BaseModel):
    payload: Dict[str, Any]


def normalize_string(value: Any, fallback: str = "") -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if value is None:
        return fallback
    return str(value).strip() or fallback


def to_number(value: Any, fallback: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def to_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return fallback


def infer_commit_action(commit_message: str, fallback: str = "update") -> str:
    text = normalize_string(commit_message, "").lower()
    if "rollback" in text:
        return "rollback"
    if "hotfix" in text or "fix" in text:
        return "fix"
    if "merge" in text:
        return "merge"
    if "refactor" in text:
        return "refactor"
    if "remove" in text or "delete" in text:
        return "remove"
    if "add" in text or "create" in text:
        return "add"
    if "update" in text or "change" in text or "chore" in text:
        return "update"
    return fallback


def infer_commit_scope(payload: Dict[str, Any]) -> str:
    combined = " ".join(
        normalize_string(payload.get(key), "").lower()
        for key in ("commit_scope", "scope", "commit_message", "message", "branch")
    )
    scope_patterns = [
        ("login", ["login", "signin", "auth"]),
        ("auth", ["authentication", "authorization"]),
        ("api", ["api", "backend", "service"]),
        ("frontend", ["frontend", "ui", "vue", "client"]),
        ("dashboard", ["dashboard", "panel", "overview"]),
        ("docker", ["docker", "container", "image"]),
        ("database", ["database", "db", "mongo"]),
        ("migration", ["migration", "migrate", "schema"]),
        ("dependencies", ["dependency", "dependencies", "package", "npm", "pip"]),
        ("environment", ["env", "environment", "secret", "config"]),
        ("tests", ["test", "tests", "qa", "coverage"]),
        ("security", ["security", "vuln", "cve"]),
        ("billing", ["billing", "payment", "pagos"]),
    ]

    for scope, keywords in scope_patterns:
        if any(keyword in combined for keyword in keywords):
            return scope

    return normalize_string(payload.get("commit_scope"), "general")


def infer_event_type(payload: Dict[str, Any]) -> str:
    explicit = normalize_string(
        payload.get("event_type") or payload.get("eventType") or payload.get("event_name") or payload.get("eventName"),
        ""
    )
    if explicit:
        return explicit.lower()
    if payload.get("pull_request") or payload.get("pullRequest"):
        return "pull_request"
    return "push"


def infer_branch_flags(payload: Dict[str, Any]) -> Dict[str, int]:
    explicit_flags = {
        "is_hotfix_branch": payload.get("is_hotfix_branch"),
        "is_feature_branch": payload.get("is_feature_branch"),
        "is_main_branch": payload.get("is_main_branch"),
    }

    if any(value is not None for value in explicit_flags.values()):
        return {
            "is_hotfix_branch": 1 if to_int(explicit_flags["is_hotfix_branch"], 0) > 0 else 0,
            "is_feature_branch": 1 if to_int(explicit_flags["is_feature_branch"], 0) > 0 else 0,
            "is_main_branch": 1 if to_int(explicit_flags["is_main_branch"], 0) > 0 else 0,
        }

    normalized = normalize_string(payload.get("branch"), "main").lower()
    return {
        "is_hotfix_branch": 1 if "hotfix" in normalized else 0,
        "is_feature_branch": 1 if "feature" in normalized else 0,
        "is_main_branch": 1 if normalized == "main" else 0,
    }


def infer_component_flags(commit_message: str, commit_scope: str) -> Dict[str, int]:
    combined = f"{normalize_string(commit_message, '')} {normalize_string(commit_scope, '')}".lower()
    return {
        "has_docker_change": 1 if "docker" in combined else 0,
        "has_db_change": 1 if "db" in combined or "database" in combined else 0,
        "has_api_change": 1 if "api" in combined else 0,
        "has_frontend_change": 1 if "frontend" in combined or "ui" in combined or "dashboard" in combined else 0,
        "has_login_change": 1 if "login" in combined or "signin" in combined or "auth" in combined else 0,
        "has_dependency_change": 1 if "dependency" in combined or "dependencies" in combined or "package" in combined else 0,
        "has_env_change": 1 if "env" in combined or "environment" in combined else 0,
        "has_migration_change": 1 if "migration" in combined or "migrate" in combined else 0,
    }


def build_model_features(payload: Dict[str, Any]) -> Dict[str, Any]:
    commit_message = normalize_string(payload.get("commit_message") or payload.get("message") or payload.get("head_commit", {}).get("message"), "")
    branch = normalize_string(payload.get("branch") or payload.get("ref") or payload.get("target_branch"), "main").replace("refs/heads/", "")
    event_type = infer_event_type(payload)
    commit_action = normalize_string(payload.get("commit_action"), infer_commit_action(commit_message))
    commit_scope = infer_commit_scope({**payload, "commit_message": commit_message, "branch": branch})
    branch_flags = infer_branch_flags(payload)
    component_flags = infer_component_flags(commit_message, commit_scope)

    files_changed = max(0, to_int(payload.get("files_changed") or payload.get("changed_files") or payload.get("filesChanged"), 1))
    lines_added = max(0, to_int(payload.get("lines_added") or payload.get("additions"), 0))
    lines_deleted = max(0, to_int(payload.get("lines_deleted") or payload.get("deletions"), 0))
    lines_changed = max(0, to_int(payload.get("lines_changed") or payload.get("changes"), lines_added + lines_deleted))

    timestamp_source = payload.get("timestamp") or payload.get("created_at") or payload.get("pushed_at")
    parsed_timestamp = pd.to_datetime(timestamp_source, errors="coerce")
    if pd.isna(parsed_timestamp):
        parsed_timestamp = pd.Timestamp.utcnow()

    dia_semana = int(parsed_timestamp.dayofweek + 1)
    hora_dia = int(parsed_timestamp.hour)
    is_weekend = 1 if dia_semana >= 6 else 0
    after_hours = 1 if hora_dia < 8 or hora_dia >= 18 else 0
    work_hours = 1 - after_hours
    high_change = 1 if lines_changed >= 250 else 0
    very_high_change = 1 if lines_changed >= 600 else 0
    many_files_changed = 1 if files_changed >= 8 else 0
    critical_component_change = int(max(component_flags.values()))
    critical_high_change = 1 if critical_component_change and (high_change or very_high_change) else 0
    hotfix_high_change = 1 if branch_flags["is_hotfix_branch"] and (high_change or very_high_change) else 0
    main_push = 1 if branch_flags["is_main_branch"] and event_type == "push" else 0
    weekend_after_hours = 1 if is_weekend and after_hours else 0
    lines_per_file = round(lines_changed / files_changed, 4) if files_changed > 0 else 0

    return {
        "branch": branch,
        "event_type": event_type,
        "commit_action": commit_action,
        "commit_scope": commit_scope,
        "files_changed": files_changed,
        "lines_added": lines_added,
        "lines_deleted": lines_deleted,
        "lines_changed": lines_changed,
        "dia_semana": dia_semana,
        "hora_dia": hora_dia,
        "is_weekend": is_weekend,
        "is_hotfix_branch": branch_flags["is_hotfix_branch"],
        "is_feature_branch": branch_flags["is_feature_branch"],
        "is_main_branch": branch_flags["is_main_branch"],
        "has_docker_change": component_flags["has_docker_change"],
        "has_db_change": component_flags["has_db_change"],
        "has_api_change": component_flags["has_api_change"],
        "has_frontend_change": component_flags["has_frontend_change"],
        "has_login_change": component_flags["has_login_change"],
        "has_dependency_change": component_flags["has_dependency_change"],
        "has_env_change": component_flags["has_env_change"],
        "has_migration_change": component_flags["has_migration_change"],
        "lines_per_file": lines_per_file,
        "lines_changed_log": float(math.log1p(lines_changed)),
        "files_changed_log": float(math.log1p(files_changed)),
        "after_hours": after_hours,
        "work_hours": work_hours,
        "high_change": high_change,
        "very_high_change": very_high_change,
        "many_files_changed": many_files_changed,
        "critical_component_change": critical_component_change,
        "critical_high_change": critical_high_change,
        "hotfix_high_change": hotfix_high_change,
        "main_push": main_push,
        "weekend_after_hours": weekend_after_hours,
    }


def build_prediction_response(probability: float) -> Dict[str, Any]:
    if probability < 0.40:
        level = "Bajo"
        decision = "Continuar flujo normal"
    elif probability < 0.70:
        level = "Medio"
        decision = "Reforzar pruebas antes de continuar"
    else:
        level = "Alto"
        decision = "Solicitar revisión técnica antes del despliegue"

    return {
        "risk_probability": round(probability, 4),
        "risk_level": level,
        "risk_decision": decision,
        "model_version": model_version if model_version != "unknown" else "catboost_v3",
        "prediction_threshold": 0.45,
    }

#ENDPOINTS

@app.get("/")
def check_health():
    return {
        "status": "ok", 
        "message": "Api IA funcionando correctamente.",
        "openai_status": ai_status,
        "ml_status": ml_status
    }

@app.post("/api/analyze-log")
def analyze_log_with_llm(request: LogAnalysisRequest):
    """ Análisis Semántico OpenAI para Logs de Error """
    if not client:
        raise HTTPException(status_code=503, detail="El servicio de IA no está configurado (revisar apiKey)")

    try:
        prompt_sistema = "Eres un Ingeniero DevOps Senior. Tu trabajo es analizar logs de errores. Tu respuesta debe tener siempre esta estructura: 1. Cita brevemente la línea exacta o el fragmento que causó el error. 2. Explica por qué falló. 3. Da los pasos accionables para solucionarlo."
        prompt_usuario = f"El pipeline del repositorio '{request.repository}' ha fallado con este error:\n\n{request.error_log}\n\nExplica brevemente por qué falló y dame 2 pasos accionables para solucionarlo."

        response = client.chat.completions.create(
            model="gpt-4o-mini", 
            messages=[
                {"role": "system", "content": prompt_sistema},
                {"role": "user", "content": prompt_usuario}
            ],
            temperature=0.3,
            max_tokens=300
        )

        return {
            "status": "success",
            "analysis": response.choices[0].message.content
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno con OpenAI: {str(e)}")

@app.post("/api/predict-risk")
def predict_deployment_risk(request: Dict[str, Any]):
    """ Predicción de riesgo con CatBoost v3 usando variables tempranas """
    if modelo_riesgo is None:
        raise HTTPException(status_code=503, detail="El modelo CatBoost no está cargado en el servidor.")

    try:
        features = build_model_features(request)
        input_frame = pd.DataFrame([{column: features.get(column, 0) for column in MODEL_COLUMNS}])

        probability = float(modelo_riesgo.predict_proba(input_frame)[0][1])
        response = build_prediction_response(probability)

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en predicción CatBoost: {str(e)}")


@app.post("/predict-risk")
def predict_deployment_risk_legacy(request: Dict[str, Any]):
    return predict_deployment_risk(request)