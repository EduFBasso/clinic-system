# backend\apps\register\services\validation_utils.py
import re
import logging

def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email) is not None

def is_valid_code(code):
    return code.isdigit() and len(code) == 4
