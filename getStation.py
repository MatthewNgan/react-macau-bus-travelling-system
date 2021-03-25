import requests,json
from multiprocessing import Process, Manager

def fetchData(stationList, routeName, color, b=True):
    direction = 0 if b else 1
    print(f"Stations - {routeName} - {direction}")
    routeR = requests.get('https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html?routeName=' + routeName + '&dir=' + str(direction) + '&lang=zh-tw')
    formattedR = routeR.json()['data']
    for index, sta in enumerate(formattedR['routeInfo']):
        if sta['staCode'] in stationList:
            l = stationList[sta['staCode']]
            b = True
            for route in l['routes']:
                if route['routeName'] == routeName and route['direction'] == direction:
                    b = False
            if b:
                l['routes'].append({'color': color, 'routeName': routeName,'direction': direction, 'directionF': formattedR['routeInfo'][-1]['staName'], 'stationIndex': index})
                l['laneName'] = sta['laneName'] if 'laneName' in sta else ''
                stationList[sta['staCode']] = l
        else:
            stationList[sta['staCode']] = {'longitude':'', 'latitude':'', 'name': sta['staName'], 'laneName': sta['laneName'] if 'laneName' in sta else '','routes': [{'color': color,'routeName': routeName,'direction': direction, 'directionF': formattedR['routeInfo'][-1]['staName'], 'stationIndex': index}]}
    aDirection = formattedR['direction']
    if aDirection == '0' and b:
        fetchData(stationList,routeName,color,False)

def fetchLocations(stationList, routeName, color, direction = 0):
    routeR = requests.get('https://bis.dsat.gov.mo:37812/macauweb/routestation/location?routeName=' + routeName + '&dir=' + str(direction) + '&lang=zh-tw')
    formattedR = routeR.json()['data']
    if 'stationInfoList' in formattedR:
        print(f"Locations - {routeName} - {direction}")
        for sta in formattedR['stationInfoList']:
            if sta['stationCode'] in stationList:
                l = stationList[sta['stationCode']]
                l['longitude'] = sta['longitude']
                l['latitude'] = sta['latitude']
                stationList[sta['stationCode']] = l
            else:
                stationList[sta['stationCode']] = {'longitude': sta['longitude'], 'latitude': sta['latitude'], 'name': sta['stationName'], 'routes': []}
    if direction == 0:
        fetchLocations(stationList,routeName,color,1)

if __name__ == '__main__':
    with Manager() as manager:
        r = requests.get('https://bis.dsat.gov.mo:37812/macauweb/getRouteAndCompanyList.html?lang=zh_tw')
        routeList = r.json()['data']['routeList']
        stationList = manager.dict()
        pl = [Process(target=fetchData, args=(stationList,route['routeName'],route['color'], True,)) for route in routeList]
        pl2 = [Process(target=fetchLocations, args=(stationList,route['routeName'],route['color'], 0,)) for route in routeList]
        for p in pl:
            p.start()
        for p in pl2:
            p.start()
        for p in pl:
            p.join()
        for p in pl2:
            p.join()
        for key,station in stationList.items():
            sortedStation = []
            for orgroute in routeList:
                for route in station['routes']:
                    if route['routeName'] == orgroute['routeName']:
                        sortedStation.append(route)
            stationList[key] = {'longitude': station['longitude'], 'latitude': station['latitude'],'laneName': station['laneName'] ,'name': station['name'], 'routes': sortedStation}
        with open(r"src/stations.json","w",encoding="utf-8") as f:
            f.write(json.dumps(dict(sorted(stationList.items())), indent=2))
        with open(r"src/stations.min.json","w",encoding="utf-8") as f:
            f.write(json.dumps(dict(sorted(stationList.items()))))
        print('Done')