from typing import List, Optional
from pydantic import BaseModel

class Ministep(BaseModel):
    title: str
    description: str

class MicrostepBlock(BaseModel):
    title: str
    mini_description: str
    detailed_description: str
    ministeps: List[Ministep]
