#!/usr/bin/env python3
"""
Python Argos Translate Helper for UAP_AnalyticsBot
Translates foreign language text into English offline using Argos Translate (MIT License).
"""

import sys
import json
import argparse

def main():
    parser = argparse.ArgumentParser(description="Offline Translator Helper")
    parser.add_argument("--from", dest="from_lang", default="de", help="Source language ISO code")
    parser.add_argument("--to", dest="to_lang", default="en", help="Target language ISO code")
    args = parser.parse_args()

    input_text = sys.stdin.read().strip()
    if not input_text:
        print(json.dumps({"translatedText": "", "status": "empty"}))
        return

    try:
        import argostranslate.package
        import argostranslate.translate

        installed_languages = argostranslate.translate.get_installed_languages()
        from_lang_obj = next((lang for lang in installed_languages if lang.code == args.from_lang), None)
        to_lang_obj = next((lang for lang in installed_languages if lang.code == args.to_lang), None)

        if from_lang_obj and to_lang_obj:
            translation = from_lang_obj.get_translation(to_lang_obj)
            translated = translation.translate(input_text)
            print(json.dumps({"translatedText": translated, "status": "success"}))
            return
        else:
            print(json.dumps({
                "translatedText": None,
                "status": "missing_language_package",
                "message": f"Package {args.from_lang}->{args.to_lang} not installed in Argos."
            }))
            return

    except ImportError:
        print(json.dumps({
            "translatedText": None,
            "status": "dependency_missing",
            "message": "argostranslate Python package is not installed."
        }))
    except Exception as e:
        print(json.dumps({
            "translatedText": None,
            "status": "error",
            "message": str(e)
        }))

if __name__ == "__main__":
    main()
