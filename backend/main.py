from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import csv
import codecs
import uvicorn

app = FastAPI(title="AI Chief of Staff Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/departments/{department_id}/upload")
async def upload_department_matrix(department_id: str, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid system record type. Upload strictly configured CSV templates only.",
        )

    try:
        csv_reader = csv.DictReader(codecs.iterdecode(file.file, "utf-8"))
        parsed_records = [row for row in csv_reader]

        return {
            "status": "success",
            "department": department_id,
            "filename": file.filename,
            "processed_records_count": len(parsed_records),
            "records": parsed_records,
            "summary": "Successfully parsed and mapped operational data vector records into analytics store.",
        }
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must be UTF-8 encoded.",
        )
    except csv.Error as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV parsing failure: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Matrix parsing failure: {str(e)}",
        )
    finally:
        await file.close()


app.include_router(router)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)