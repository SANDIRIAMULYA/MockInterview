import os
import tempfile
import whisper
from pydub import AudioSegment
from pydub.silence import detect_silence
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Whisper model
model = whisper.load_model("base")

def convert_to_wav(input_path, output_path):
    """Convert any audio file to WAV format using pydub"""
    try:
        # Explicitly specify codec for webm files
        if input_path.endswith('.webm'):
            audio = AudioSegment.from_file(input_path, codec="opus")
        else:
            audio = AudioSegment.from_file(input_path)
        
        audio.export(output_path, format="wav", codec="pcm_s16le")
        return True
    except Exception as e:
        logger.error(f"Error converting audio to WAV: {e}")
        return False

def detect_pauses(audio_path, silence_thresh=-40, min_silence_len=1000):
    """Detect pauses in audio file"""
    try:
        audio = AudioSegment.from_file(audio_path)
        silences = detect_silence(
            audio, 
            min_silence_len=min_silence_len, 
            silence_thresh=silence_thresh
        )
        pauses = [{"start": round(start / 1000, 2), "end": round(end / 1000, 2)} 
                 for start, end in silences]
        return pauses
    except Exception as e:
        logger.error(f"Error detecting pauses: {e}")
        return []

def transcribe_audio_file(audio_file, file_extension=".webm"):
    """Transcribe audio file and detect pauses"""
    temp_audio_path = None
    wav_path = None
    
    try:
        # Save uploaded audio to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_audio:
            temp_audio_path = temp_audio.name
            audio_file.save(temp_audio_path)

        # Create WAV file path
        wav_path = temp_audio_path.replace(file_extension, ".wav")
        
        # Convert to WAV format
        if not convert_to_wav(temp_audio_path, wav_path):
            return {
                "error": "Audio conversion failed",
                "pauses": [],
                "segments": [],
                "text": ""
            }

        # Transcribe with Whisper
        result = model.transcribe(wav_path, language="en")


        # Detect pauses
        pauses = detect_pauses(wav_path)

        return {
            "segments": result.get("segments", []),
            "text": result.get("text", ""),
            "pauses": pauses
        }

    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        return {
            "error": str(e),
            "pauses": [],
            "segments": [],
            "text": ""
        }

    finally:
        # Clean up temp files
        for path in [temp_audio_path, wav_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as e:
                    logger.error(f"Error removing temp file {path}: {e}")