import requests,json
from multiprocessing import Process, Manager

def fetchData(stationList, routeName,b=True):
    direction = 0 if b else 1
    print(f"Stations - {routeName} - {direction}")
    routeR = requests.get('https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html?routeName=' + routeName + '&dir=' + str(direction) + '&lang=zh-tw')
    formattedR = routeR.json()['data']
    for sta in formattedR['routeInfo']:
        if sta['staCode'] in stationList:
            l = stationList[sta['staCode']]
            l['routes'].append({'routeName': routeName,'direction': direction})
            stationList[sta['staCode']] = l
        else:
            stationList[sta['staCode']] = {'longitude':'', 'latitude':'', 'name': sta['staName'],'routes': [{'routeName': routeName,'direction': direction}]}
    aDirection = formattedR['direction']
    if aDirection == '0' and b:
        fetchData(stationList,routeName,False)

def fetchLocations(stationList, routeName, direction = 0):
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
        fetchLocations(stationList,routeName,1)

if __name__ == '__main__':
    with Manager() as manager:
        r = requests.get('https://bis.dsat.gov.mo:37812/macauweb/getRouteAndCompanyList.html?lang=zh_tw')
        routeList = r.json()['data']['routeList']
        stationList = manager.dict()
        pl = [Process(target=fetchData, args=(stationList,route['routeName'], True,)) for route in routeList]
        pl2 = [Process(target=fetchLocations, args=(stationList,route['routeName'], 0,)) for route in routeList]
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
            stationList[key] = {'longitude': station['longitude'], 'latitude': station['latitude'],'name': station['name'], 'routes': sortedStation}
        with open(r"public/stations.json","w",encoding="utf-8") as f:
            f.write(json.dumps(dict(sorted(stationList.items())), indent=2))
        with open(r"public/stations.min.json","w",encoding="utf-8") as f:
            f.write(json.dumps(dict(sorted(stationList.items()))))
        print('Done')