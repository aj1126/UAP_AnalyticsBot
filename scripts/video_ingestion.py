import os
import sys
import json
import argparse
from pathlib import Path

def format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"

def process_video(file_path: str, output_dir: str):
    video_path = Path(file_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Check dependencies
    try:
        try:
            from moviepy.editor import VideoFileClip
        except ImportError:
            from moviepy import VideoFileClip
    except ImportError as e:
        print(json.dumps({
            "error": f"Missing python dependency 'moviepy': {str(e)}",
            "duration": 0,
            "transcripts": [],
            "extractedFrames": []
        }))
        return

    has_whisper = False
    try:
        import whisper
        import torch
        has_whisper = True
    except ImportError:
        # Whisper not available (e.g. incompatible Python version)
        pass

    original_stdout = sys.stdout
    sys.stdout = sys.stderr

    temp_audio_path = out_dir / f"{video_path.stem}_temp_audio.wav"
    clip = None
    try:
        clip = VideoFileClip(str(video_path))
        duration = clip.duration
        
        # 1. Extract audio track if whisper is available
        has_audio = False
        if has_whisper and clip.audio is not None:
            try:
                clip.audio.write_audiofile(
                    str(temp_audio_path),
                    codec='pcm_s16le',
                    fps=16000, # whisper works best with 16kHz audio
                    verbose=False,
                    logger=None
                )
            except TypeError:
                clip.audio.write_audiofile(
                    str(temp_audio_path),
                    codec='pcm_s16le',
                    fps=16000
                )
            has_audio = True
            
        # 2. Extract frames every 15 seconds
        extracted_frames = []
        interval = 15.0 # seconds
        current_time = 0.0
        while current_time < duration:
            frame_path = out_dir / f"frame_{int(current_time)}.png"
            clip.save_frame(str(frame_path), t=current_time)
            extracted_frames.append({
                "timestamp": format_timestamp(current_time),
                "path": str(frame_path.absolute())
            })
            current_time += interval
            
        # 3. Transcribe audio using Whisper
        transcripts = []
        if has_whisper and has_audio and temp_audio_path.exists():
            model = whisper.load_model("tiny")
            result = model.transcribe(str(temp_audio_path))
            
            for segment in result.get("segments", []):
                transcripts.append({
                    "timestamp": format_timestamp(segment.get("start", 0.0)),
                    "text": segment.get("text", "").strip()
                })
                
        # Consolidate and output
        output_data = {
            "duration": duration,
            "transcripts": transcripts,
            "extractedFrames": extracted_frames
        }
        if not has_whisper:
            output_data["warning"] = "Whisper transcription skipped (whisper package not installed/supported)"
        
        sys.stdout = original_stdout
        print(json.dumps(output_data))
        
    except Exception as e:
        sys.stdout = original_stdout
        print(json.dumps({
            "error": f"Failed during processing: {str(e)}",
            "duration": 0,
            "transcripts": [],
            "extractedFrames": []
        }))
    finally:
        # Restore stdout just in case
        sys.stdout = original_stdout
        # Cleanup
        if clip is not None:
            clip.close()
        if temp_audio_path.exists():
            try:
                os.remove(temp_audio_path)
            except OSError:
                pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process video file for telemetry ingestion.")
    parser.add_argument("--file", required=True, help="Path to video file")
    parser.add_argument("--output-dir", required=True, help="Directory to save keyframes")
    args = parser.parse_args()
    
    process_video(args.file, args.output_dir)
