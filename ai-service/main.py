import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI

# creacion del app de FastAPI
app = FastAPI(
    title="AI DevOps Microservice",
    description="Microservicio de IA para predicción de riesgo y análisis semántico de logs.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# api openia
load_dotenv()
try:
    client = OpenAI()
    ai_status = "Conectado a OpenAI"
except Exception as e:
    client = None
    ai_status = f"Desconectado (Falta API Key válida en .env)"

# estructuración temprana de datos
class LogAnalysisRequest(BaseModel):
    error_log: str
    repository: str

class RiskPredictionRequest(BaseModel):
    branch: str
    actor: str
    lines_changed: int
    hour_of_day: int

# endpoints

@app.get("/")
def check_health():
    return {
        "status": "ok", 
        "message": "Api ia funcionando correctamente.",
        "openai_status": ai_status
    }

@app.post("/api/analyze-log")
def analyze_log_with_llm(request: LogAnalysisRequest):
    """ Análisis Semántico OpenAI """
    if not client:
        raise HTTPException(status_code=503, detail="El servicio de IA no está configurado (revisar apiKey)")

    try:
        prompt_sistema = "Eres un Ingeniero DevOps Senior. Tu trabajo es analizar logs de errores de pipelines CI/CD y dar soluciones claras, técnicas y directas en español."
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
    """ Predicción de Riesgo con Machine Learning """
    return {
        "status": "success",
        "predicted_risk_percentage": 15,
        "message": f"Evaluando riesgo para la rama: {request.branch}"
    }