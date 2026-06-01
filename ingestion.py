import os
import sys
import asyncio
import argparse
from pathlib import Path

class IngestionEngine:
    def __init__(self, source_directory: str):
        self.source_dir = Path(source_directory)
        # Targeting our specific multi-media and image requirements
        self.supported_extensions = {'.pdf', '.mp4', '.jpg', '.jpeg', '.png'}
        
    async def scan_directory(self):
        """
        Asynchronously scans the source directory for supported files.
        Operates with strict read-only access to preserve original data.
        """
        if not self.source_dir.exists():
            raise FileNotFoundError(f"Source directory not found: {self.source_dir}")

        print(f"Scanning '{self.source_dir}' for analytics processing...")
        print("-" * 50)
        
        # Read-only generation of file paths
        count = 0
        for root, _, files in os.walk(self.source_dir):
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in self.supported_extensions:
                    count += 1
                    yield file_path
                    
        if count == 0:
            supported = ", ".join(sorted(self.supported_extensions))
            print(f"No supported files ({supported}) found in the specified directory.")

async def main(folder_path: str):
    try:
        engine = IngestionEngine(folder_path)
        
        # In the future, this is where we will route files to the Extraction Node
        async for file in engine.scan_directory():
            print(f"[FOUND] {file.name}")
            
    except FileNotFoundError as e:
        print(f"\n[ERROR] {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Setup the manual command-line trigger
    parser = argparse.ArgumentParser(
        description="Run batch analytics on a designated source folder."
    )
    
    parser.add_argument(
        "source_path", 
        type=str, 
        help="The absolute or relative path to the folder you want to scan."
    )
    
    args = parser.parse_args()
    
    # Execute the asynchronous pipeline
    asyncio.run(main(args.source_path))