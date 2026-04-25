import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
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

# CARGA DEL MODELO MACHINE LEARNING (KAGGLE)
MODEL_PATH = "catboost_despliegues.cbm"
if os.path.exists(MODEL_PATH):
    modelo_riesgo = CatBoostClassifier()
    modelo_riesgo.load_model(MODEL_PATH)
    ml_status = "Modelo CatBoost Cargado"
else:
    modelo_riesgo = None
    ml_status = "Desconectado (Falta el archivo .cbm)"

# ESTRUCTURAS DE DATOS
class LogAnalysisRequest(BaseModel):
    error_log: str
    repository: str

class RiskPredictionRequest(BaseModel):
    actor: str
    branch: str
    lines_changed: int
    execution_time_seg: int 
    dia_semana: int 
    hora_dia: int   

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
def predict_deployment_risk(request: RiskPredictionRequest):
    """ Predicción de riesgo con CatBoost """
    if modelo_riesgo is None:
        raise HTTPException(status_code=500, detail="El modelo CatBoost no está cargado en el servidor.")

    try:
        actor = request.actor.strip().lower()
        branch = request.branch.strip().lower()
        is_weekend = 1 if request.dia_semana in [6, 7] else 0
        lines_per_min = request.lines_changed / ((request.execution_time_seg / 60) + 1e-6)

        # CatBoost usa exactamente las features con las que se entrenó en Kaggle.
        datos_entrada = pd.DataFrame([{
            'actor': actor,
            'branch': branch,
            'lines_changed': request.lines_changed,
            'execution_time_seg': request.execution_time_seg,
            'dia_semana': request.dia_semana,
            'hora_dia': request.hora_dia,
            'is_weekend': is_weekend,
            'lines_per_min': lines_per_min
        }])

        prob_fallo = float(modelo_riesgo.predict_proba(datos_entrada)[0][1]) * 100

        veredicto = "Seguro"
        if prob_fallo >= 75:
            veredicto = "Peligro Crítico"
        elif prob_fallo >= 40:
            veredicto = "Advertencia"

        return {
            "status": "success",
            "riesgo_porcentaje": round(prob_fallo, 2),
            "veredicto": veredicto,
            "mensaje": f"El algoritmo estima un {round(prob_fallo, 2)}% de probabilidad de fallo en producción."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en predicción CatBoost: {str(e)}")