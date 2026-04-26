import requests

url = "http://127.0.0.1:5000/analyze"

files = {'file': open('data.csv', 'rb')}

response = requests.post(url, files=files)

print(response.json())