import os
import asyncio
from pathlib import Path

class IngestionEngine:
    def __init__(self, source_directory: str):
        self.source_dir = Path(source_directory)
        # Targeting our specific multi-media requirements
        self.supported_extensions = {'.pdf', '.mp4'}
        
    async def scan_directory(self):
        """
        Asynchronously scans the source directory for supported files.
        Operates with strict read-only access to preserve original data.
        """
        if not self.source_dir.exists():
            raise FileNotFoundError(f"Source directory not found: {self.source_dir}")

        print(f"Scanning {self.source_dir} for analytics processing...")
        
        # Read-only generation of file paths
        for root, _, files in os.walk(self.source_dir):
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in self.supported_extensions:
                    yield file_path

async def main():
    # Example local path; Copilot will adapt this to your environment
    engine = IngestionEngine("./source_data_folder")
    
    async for file in engine.scan_directory():
        print(f"Identified for processing: {file.name}")

if __name__ == "__main__":
    asyncio.run(main())