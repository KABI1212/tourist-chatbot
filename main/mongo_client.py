import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

_client = None

def get_mongo_db():
    global _client
    if _client is None:
        mongo_uri = os.environ.get("MONGODB_URI")
        _client = MongoClient(mongo_uri)
    return _client["tourist_chatbot"]

def get_chat_collection():
    return get_mongo_db()["chat_history"]