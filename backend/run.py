import uvicorn
import os
import sys

if __name__ == "__main__":
    # Ensure backend directory is in python path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    port = int(os.getenv("PORT", 8080))
    print("Starting AI Financial Research Assistant server...")
    print(f"Dashboard will be available at: http://localhost:{port}")
    
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=port, reload=True)
