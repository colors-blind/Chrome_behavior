from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import uvicorn
import json
import os
from datetime import datetime

app = FastAPI(title="Chrome Request Logger API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Position(BaseModel):
    x: int
    y: int

class HttpRequestEvent(BaseModel):
    type: str
    timestamp: str
    method: Optional[str] = None
    url: Optional[str] = None
    requestId: Optional[str] = None
    type_detail: Optional[str] = Field(None, alias="type")
    initiator: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    statusCode: Optional[int] = None
    statusLine: Optional[str] = None
    fromCache: Optional[bool] = None
    ip: Optional[str] = None
    responseSize: Optional[int] = None
    error: Optional[str] = None
    requestBody: Optional[Any] = None
    response: Optional[Any] = None
    duration: Optional[int] = None
    pageUrl: Optional[str] = None

    class Config:
        populate_by_name = True

class XhrFetchEvent(BaseModel):
    type: str
    timestamp: str
    pageUrl: str
    method: str
    url: str
    headers: Optional[Dict[str, Any]] = None
    body: Optional[Any] = None
    status: Optional[int] = None
    statusText: Optional[str] = None
    response: Optional[Any] = None
    duration: Optional[int] = None
    error: Optional[str] = None

class UserBehaviorEvent(BaseModel):
    type: str
    timestamp: str
    pageUrl: str
    tag: Optional[str] = None
    inputType: Optional[str] = None
    id: Optional[str] = None
    name: Optional[str] = None
    value: Optional[str] = None
    x: Optional[int] = None
    y: Optional[int] = None
    dwellMs: Optional[int] = None
    from_pos: Optional[Position] = Field(None, alias="from")
    to_pos: Optional[Position] = Field(None, alias="to")
    target: Optional[str] = None

    class Config:
        populate_by_name = True

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")
STORAGE_DIR = os.path.abspath(STORAGE_DIR)
os.makedirs(STORAGE_DIR, exist_ok=True)

def get_safe_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc or "unknown"
        domain = "".join(c if c.isalnum() or c in "._-" else "_" for c in domain)
        return domain
    except Exception:
        return "unknown"

def store_request_data(data: Dict[str, Any], source: str) -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    event_type = data.get("type", "unknown")
    
    safe_url = data.get("url", data.get("pageUrl", "unknown"))
    domain = get_safe_domain(safe_url)
    
    dir_path = os.path.join(STORAGE_DIR, domain)
    os.makedirs(dir_path, exist_ok=True)
    
    filename = f"{source}_{timestamp}_{event_type}.json"
    file_path = os.path.join(dir_path, filename)
    
    data["_storage"] = {
        "source": source,
        "stored_at": datetime.now().isoformat(),
        "file_path": file_path
    }
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        print(f"  [Stored] {file_path}")
    except Exception as e:
        print(f"  [Storage Error] Failed to write {file_path}: {e}")

@app.get("/")
async def root():
    return {
        "message": "Chrome Request Logger API",
        "version": "1.0.0",
        "status": "running",
        "storage_dir": STORAGE_DIR
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/api/requests")
async def log_request(event: HttpRequestEvent):
    data = event.model_dump(by_alias=False)
    print(f"\n[HTTP Request] {data['type']} - {data.get('method')} {data.get('url')}")
    print(f"  Request ID: {data.get('requestId')}")
    if data.get('headers'):
        print(f"  Headers: {json.dumps(data['headers'], ensure_ascii=False)[:200]}")
    if data.get('statusCode'):
        print(f"  Status: {data['statusCode']}")
    if data.get('error'):
        print(f"  Error: {data['error']}")
    
    store_request_data(data, "http")
    return {"status": "received", "requestId": data.get('requestId')}

@app.post("/api/xhr")
async def log_xhr(event: XhrFetchEvent):
    data = event.model_dump()
    print(f"\n[XHR/Fetch] {data['type']} - {data['method']} {data['url']}")
    print(f"  Page URL: {data['pageUrl']}")
    if data.get('headers'):
        print(f"  Headers: {json.dumps(data['headers'], ensure_ascii=False)[:200]}")
    if data.get('status'):
        print(f"  Status: {data['status']}")
    if data.get('duration'):
        print(f"  Duration: {data['duration']}ms")
    if data.get('response'):
        response_str = json.dumps(data['response'], ensure_ascii=False, default=str) if not isinstance(data['response'], str) else data['response']
        print(f"  Response: {response_str[:300]}{'...' if len(response_str) > 300 else ''}")
    if data.get('error'):
        print(f"  Error: {data['error']}")
    
    store_request_data(data, "xhr")
    return {"status": "received"}

@app.post("/api/behavior")
async def log_behavior(event: UserBehaviorEvent):
    data = event.model_dump(by_alias=False)
    print(f"\n[Behavior] {data['type']} at {data['pageUrl']}")
    if data.get('value'):
        print(f"  Value: {data['value'][:100] if len(data['value']) > 100 else data['value']}")
    if data.get('x') is not None and data.get('y') is not None:
        print(f"  Position: ({data['x']}, {data['y']})")
    
    store_request_data(data, "behavior")
    return {"status": "received"}

@app.post("/api/batch")
async def log_batch(request: Request):
    events = await request.json()
    if not isinstance(events, list):
        raise HTTPException(status_code=400, detail="Expected an array of events")
    
    count = len(events)
    print(f"\n[Batch] Received {count} events")
    
    for idx, event in enumerate(events):
        event_type = event.get("type", "unknown")
        if event_type.startswith("http_") or event_type.startswith("xhr_") or event_type.startswith("fetch_"):
            url = event.get("url", event.get("pageUrl", "unknown"))
            print(f"  [{idx+1}] {event_type}: {url}")
            store_request_data(event, "http")
        else:
            print(f"  [{idx+1}] {event_type}")
            store_request_data(event, "behavior")
    
    return {"status": "received", "count": count}

if __name__ == "__main__":
    print("=" * 60)
    print("Chrome Request Logger Backend Server")
    print("=" * 60)
    print(f"Storage Directory: {STORAGE_DIR}")
    print(f"Server starting at: http://localhost:8000")
    print(f"API Docs: http://localhost:8000/docs")
    print("=" * 60)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
