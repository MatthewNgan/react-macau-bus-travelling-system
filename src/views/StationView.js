import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from '!mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import * as helpers from '@turf/helpers';
import jsonData from '../stations.json';
import AppData from '../AppData'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import buffer from '@turf/buffer'
import nearestPoint from '@turf/nearest-point';
import distance from '@turf/distance';
import { disableBodyScroll } from 'body-scroll-lock';
import './StationView.css'

function usePrevious(value) {
  const ref = React.useRef();
  React.useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

function StationView(props) {

  let gstationData = JSON.parse(JSON.stringify(jsonData));
  let gstationShownOnMap = {};
  let gfocusedStation = null;
  let gcenter = null;
  let isMapMoving = null;
  let scrolling = false;
  let mapCenter = null;
  let fetchController = new AbortController();

  const [stationMap, _setStationMap] = React.useState(null);
  const stationMapRef = React.useRef(stationMap);
  const setStationMap = map => {
    stationMapRef.current = map;
    _setStationMap(map);
  }
  const [currentView, _setCurrentView] = React.useState('route');
  const currentViewRef = React.useRef(currentView);
  const setCurrentView = view => {
    currentViewRef.current = view;
    _setCurrentView(view);
  }
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [isStationLoaded, setIsStationLoaded] = React.useState(false);
  const [isStationReady, setIsStationReady] = React.useState(false);
  const [isZoomTooSmall, setIsZoomTooSmall] = React.useState(true);
  const [currentList, setCurrentList] = React.useState('nearest');
  const [nearestStationList, setNearestStationList] = React.useState([]);
  const [routesShowing, setRoutesShowing] = React.useState(5);
  const [shouldModalBeShown, setShouldModalBeShown] = React.useState(false);

  const [hidingStation, setHidingStation] = React.useState(false);

  const focusToMarker = (marker) => {
    for (let sta of Object.values(gstationShownOnMap)) {
      if (sta.marker === marker) {
        marker.getElement().style.opacity = 1;
        marker.getElement().style.zIndex = 998;
      } else {
        sta.marker.getElement().style.opacity = 0.2;
        sta.marker.getElement().style.removeProperty('z-index');
      }
    }
  }

  const handleListChange = (list) => {
    setCurrentList(list);
  }

  React.useEffect(() => {
    const details = document.querySelectorAll('.station-info-list .main-list details');
    details.forEach((targetDetail) => {
      targetDetail.open = false;
      targetDetail.addEventListener('click', () => {
        details.forEach((detail) => {
          if (detail !== targetDetail) {
            detail.removeAttribute('open');
          }
        });
      });
    });
  }, [currentList]);

  const hideStation = () => {
    for (let sta of Object.values(gstationShownOnMap)) {
      if(sta.marker != null) {
        sta.marker.getElement().style.opacity = 0;
        setTimeout(() => sta.marker.remove(), 500)
      }
    }
    gfocusedStation = null;
    gstationShownOnMap = {};
    
    setIsStationLoaded(false);
    setIsStationReady(false);
    setIsZoomTooSmall(true);
    setNearestStationList({});
    setRoutesShowing(5);
    setHidingStation(true);
  }

  React.useEffect(() => {
    if (hidingStation) {
      document.querySelector('#station-view').dispatchEvent(new Event('scroll'))
      setHidingStation(false);
    }
  }, [hidingStation]);

  const requestRoute = (route,color,direction,index=0) => {
    setShouldModalBeShown(true);
  }

  const setNumberOfRoutesShowing = (n) => {
    setRoutesShowing(n);
  }

  const showStation = (polygon) => {
    for (let [code, station] of Object.entries(gstationData)) {
      let staLoc = [parseFloat(station.longitude), parseFloat(station.latitude)]
      if (booleanPointInPolygon(staLoc, polygon)) {
        if (!gstationShownOnMap[code]) {
          let element = <div onClick={() => {
            stationMap.flyTo({center: staLoc});
          }} className={`station-marker${AppData.mainStations.includes(code.split('/')[0]) ? ' main-station' : ''}`}></div>
          let container = document.createElement('div');
          ReactDOM.render(element, container);
          let staMarker = new mapboxgl.Marker({element: container}).setLngLat(staLoc).addTo(stationMap);
          gstationShownOnMap[code] = {marker: staMarker, data: station};
          staMarker.getElement().style.opacity = 0;
          setTimeout(() => staMarker.getElement().style.opacity = 0.2, 50)
        }
      } else {
        if (gstationShownOnMap[code]) {
          gstationShownOnMap[code].marker.getElement().style.opacity = 0;
          setTimeout(() => {
            if (gstationShownOnMap[code]) {
              gstationShownOnMap[code].marker.remove();
              delete gstationShownOnMap[code];
            }
          }, 250)
        }
      }
    }
    setTimeout(() => {
      let pointsCollection = helpers.featureCollection(Object.values(gstationShownOnMap).map(station => {
        return helpers.point(station.marker.getLngLat().toArray())
      }))
      let index;
      let stationShownOnMapEntries;
      if (pointsCollection.features.length > 0) {
        index = nearestPoint(stationMap.getCenter().toArray(), pointsCollection).properties.featureIndex;
        for (let [code,station] of Object.entries(gstationShownOnMap)) {
          let from = helpers.point(stationMap.getCenter().toArray());
          let to = helpers.point([parseFloat(station.data.longitude), parseFloat(station.data.latitude)]);
          let d = distance(from, to);
          gstationShownOnMap[code].distanceToCenter = d;
        }
        stationShownOnMapEntries = Object.entries(gstationShownOnMap).sort((a,b) => a[1].distanceToCenter > b[1].distanceToCenter ? 1 : (a[1].distanceToCenter < b[1].distanceToCenter ? -1 : 0));
        for (let sta of Object.values(gstationShownOnMap)) {
          if (sta.marker !== Object.values(gstationShownOnMap)[index].marker) {
            sta.marker.getElement().style.opacity = 0.2;
            sta.marker.getElement().style.removeProperty('z-index');
          } else {
            sta.marker.getElement().style.opacity = 1;
            sta.marker.getElement().style.zIndex = 998;
            gfocusedStation = sta.marker;
          }
        }
      } else {
        gfocusedStation = null;
      }
      gcenter.getElement().style.opacity = 1;
      document.querySelector('#station-map .center').style.animation = 'none';
      setIsStationReady(true);
      setIsStationLoaded(true);
      setNearestStationList(stationShownOnMapEntries);
      setRoutesShowing((nearestStationList?.[0]?.[0] === stationShownOnMapEntries?.[0]?.[0]) ? routesShowing : 5);
      setTimeout(() => {
        document.querySelector('#station-map .center').style.animation = '0.15s bounce linear';
        const details = document.querySelectorAll('.station-info-list .main-list details');
        details.forEach((targetDetail) => {
          targetDetail.open = false;
          targetDetail.addEventListener('click', () => {
            details.forEach((detail) => {
              if (detail !== targetDetail) {
                detail.removeAttribute('open');
              }
            });
          });
        });
        if (details[0]) {
          details[0].open = true;
          if (document.querySelector('#station-view').scrollTop < document.querySelector('.main-list details:first-child summary').offsetHeight)
          document.querySelector('#station-view').scroll({top: document.querySelector('.main-list details:first-child').offsetHeight - 1, behavior: 'smooth'});
        } else if (document.querySelector('#station-view .no-station')) {
          document.querySelector('#station-view').scroll({top: document.querySelector('#station-view .no-station').offsetHeight - 1, behavior: 'smooth'});
        }
      }, 1);
    }, 250);
  }

  React.useEffect(() => {
    if (stationMap) {
      stationMap.touchZoomRotate.disableRotation();
      let geolocate = new mapboxgl.GeolocateControl({
        fitBoundsOptions: {
          maxZoom: 16.5,
          duration: 250,
        },
        positionOptions: {
          enableHighAccuracy: true
        },
      })
      stationMap.addControl(geolocate);
      stationMap.on('load', () => {
        geolocate.trigger();
        let centerElement = <div className='center'></div>
        let centerContainer = document.createElement('div')
        ReactDOM.render(centerElement, centerContainer);
        gcenter = new mapboxgl.Marker({element: centerContainer}).setLngLat(stationMap.getCenter().toArray()).addTo(stationMap)
        gcenter.getElement().style.zIndex = 999;
        document.querySelector('#station-view').dispatchEvent(new Event('scroll'))
        stationMap.on('move', () => {
          let orgLng = gcenter.getLngLat().toArray()[0]; let orgLat = gcenter.getLngLat().toArray()[1];
          let newLng = stationMap.getCenter().toArray()[0]; let newLat = stationMap.getCenter().toArray()[1];
          if (orgLng !== newLng && orgLat !== newLat) {
            gcenter.setLngLat(stationMap.getCenter().toArray())
            gcenter.getElement().style.opacity = 0.5;
            if (gfocusedStation) {
              gfocusedStation.getElement().style.opacity = 0.2;
            }
            setIsStationLoaded(false);
            if (isMapMoving) clearTimeout(isMapMoving);
            isMapMoving = setTimeout(() => {
              if (currentViewRef.current === 'station') {
                if (stationMap.getZoom() > 15.5) {
                  setIsZoomTooSmall(false);
                  setIsStationLoaded(false);
                  let center = helpers.point(gcenter.getLngLat().toArray());
                  let buffered = buffer(center, 0.25);
                  showStation(buffered);
                } else {
                  gcenter.getElement().style.opacity = 1;
                  document.querySelector('#station-map .center').style.animation = 'none'
                  setTimeout(() => document.querySelector('#station-map .center').style.animation = '0.15s bounce linear', 1);
                  hideStation();
                }
              }
            }, 250);;
          }
        })
      })
    }
  }, [stationMap]);

  const initMap = () => {
    let mapStyle = 'mapbox://styles/matthewngan/ckl22d4c40lj019qooa3513mb';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mapStyle = 'mapbox://styles/matthewngan/ckl22uo2n0t2817mvzzhiakwk';
    }
    setStationMap(new mapboxgl.Map({
      container: 'station-map',
      style: mapStyle, // stylesheet location
      center: [113.5622406,22.166422], // starting position [lng, lat]
      zoom: 11.5, // starting zoom
      minZoom: 10.5,
      maxZoom: 18.5,
      dragRotate: false,
      touchPitch: false,
    }));
  }

  React.useEffect(() => {
    if (stationMap != null) {
      stationMap.on('load', () => {
        document.querySelector('#station-view').addEventListener('scroll', () => {
          if (stationMap != null) {
            scrolling = true
            stationMap.easeTo({
              padding: {
                'bottom': (document.querySelector('#station-view').scrollTop + document.querySelector('.station-info-list nav')?.offsetHeight) || 0
              },
              duration: 0,
              center: stationMap.getCenter(),
            })
          }
        });
      })
    }
  }, [stationMap]);

  React.useEffect(() => {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',
      () => {
        let mapStyle = 'mapbox://styles/matthewngan/ckjzsnvju0uqx17o6891qzch5';
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          mapStyle = 'mapbox://styles/matthewngan/ckjzsftuo0uik17o62fm4oahc';
        }
        stationMap.setStyle(mapStyle);
      }
    );
    disableBodyScroll(document.querySelector('#station-view'));
    document.querySelector('#station-map').style.height = `calc(var(--view-height) - ${document.querySelector('.station-info-list nav')?.offsetHeight || 0}px)`

    return () => {
      stationMapRef.current.remove();
      setStationMap(null);
    }
  }, []);


  React.useEffect(() => {
    if (currentView !== 'station') {
      document.querySelector('#station-view').dispatchEvent(new Event('scroll'));
    }
  })

  React.useEffect(() => {
    setCurrentView(props.currentView);
    if (props.currentView === 'station' && stationMap == null) {
      initMap();
    }
  }, [props]);
  
  return (
    <div className={`view${props.currentView === 'station' ? ' active' : ''}`} id='station-view'>
      <header className='view-header-top fixed-top row justify-content-md-center'>
        <h6 className='col-auto'>站點查詢</h6>
      </header>
      <div id='station-map'></div>
      {!isZoomTooSmall && 
      <StationInfoList
        currentView={props.currentView}
        calculateTime={props.calculateTime}
        setNumberOfRoutesShowing={setNumberOfRoutesShowing}
        routesShowing={routesShowing}
        focusToMarker={focusToMarker}
        handleListChange={handleListChange}
        nearestStationList={nearestStationList}
        isStationReady={isStationReady}
        isStationLoaded={isStationLoaded}
        currentList={currentList}
        handleNetworkError={props.handleNetworkError}
        requestRoute={props.toggleRouteModal}></StationInfoList>}
      <ZoomTooSmallNotifs isZoomTooSmall={isZoomTooSmall}></ZoomTooSmallNotifs>
    </div>
  )
}

function StationInfoList(props) {
  let stationData = JSON.parse(JSON.stringify(jsonData));
  let intervals = [];

  const [stationRTData, setStationRTData] = React.useState({});

  const getStationRTData = (code) => {
    for (let route of stationData[code].routes) {
      // let busInfoLocations = locationData?.busInfoList;
      // if (busInfoLocations && routeTraffic) {
      fetch(`${AppData?.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/bus?routeName=${route.routeName}&dir=${route.direction}`)
      .then(response => {
        if(response?.status >= 200 && response?.status < 300) {
            return response?.json();
        } else {
            throw new Error('Server/Network Error: ' + response?.status);
        }
      })
      .then(data => {
        props.handleNetworkError(false);
        let index = route.stationIndex;
        let busData = data.data;
        let stationBefore = busData?.routeInfo?.slice(0, index+1)?.reverse();
        let count = 0;
        let tempArr = [];
        for (let i = 0; i < Math.max(Math.min(stationBefore.length, index+1),1); i++) {
          for (let comingBus of stationBefore[i]?.busInfo) {
            if (count < 1) {
              if (((i === 0 && parseInt(comingBus?.status) === 1) || i !== 0) || (stationBefore.length < index && i === 0) || (index === 0 && i === 0 && parseInt(comingBus?.status) === 1)) {
                tempArr?.push({
                  'plate': `${comingBus?.busPlate?.substring(0,2)}-${comingBus?.busPlate?.substring(2,4)}-${comingBus?.busPlate?.substring(4,6)}`,
                  'speed': comingBus?.speed,
                  'stopsRemaining': i,
                  'currentStation': index - i,
                });
                count++;
              }
            }
          }
        }
        setStationRTData(prevState => ({
          ...prevState,
          [code]: {
            ...prevState[code],
            [`${route.routeName}-${route.direction}`]: tempArr
          }
        }))
      })
      .catch(error => {
        console.log(error);
        if (error instanceof TypeError) {
          props.handleNetworkError(true);
        }
      })
    }
  }

  const prevView = usePrevious(props.currentView);

  React.useEffect(() => {
    if (prevView !== 'station' && props.currentView === 'station' && document.querySelector('.station-info-list .main-list details[open]') != null) {
      document.querySelector('.station-info-list .main-list details[open]').dispatchEvent(new Event('toggle'));
    }
  });

  return(
    <div className={`station-info-list${props.isStationLoaded ? ' loaded' : ''}`}>
      <nav className='row'>
        <span className={`col${props.currentList === 'nearest' ? ' active' : ''}`} onClick={() => props.handleListChange('nearest')}>附近站點</span>
        {/* <span className={`col${props.currentList === 'favorites' ? ' active' : ''}`} onClick={() => props.handleListChange('favorites')}>已收藏站點</span> */}
      </nav>
      {/* {
        props.currentList === 'nearest' ? */
        <div className='main-list'>
          {
            props.nearestStationList?.length > 0 ? props.nearestStationList.map(sta => {
              return <details id={sta[0]} key={sta[0]} onToggle={() => {
                if (document.getElementById(sta[0])?.open) {
                  getStationRTData(sta[0]);
                  if (intervals[sta[0]] != null) {
                    clearInterval(intervals[sta[0]]);
                  }
                  intervals[sta[0]] = setInterval(() => {
                    if (document.getElementById(sta[0])?.open && props.currentView === 'station') getStationRTData(sta[0]);
                    else {
                      clearInterval(intervals?.[sta[0]]);
                    };
                  }, 10000);
                } else {
                  clearInterval(intervals?.[sta[0]]);
                }
              }}>
                <summary className='station-list-summary' onClick={() => {props.setNumberOfRoutesShowing(5);props.focusToMarker(sta[1].marker);}}>
                  <div className='title'>
                    <div className='title-code'>{sta[0]}</div>
                    <div className='title-name'>{sta[1].data.name}<small className='text-muted'> {Math.round(sta[1].distanceToCenter*1000)}m</small></div>
                    {
                      sta[1].data.laneName && 
                      <code className={`lane ${sta[0].split('/')[0]} ${sta[1].data.laneName[0]}`}>{sta[1].data.laneName}</code>
                    }
                  </div>
                  <div className='routes'>
                    {
                      sta[1].data.routes.slice(0,10).map(route => route.routeName).join(' ')
                    }
                    {
                      sta[1].data.routes.length > 11 ?
                      <code className='more-routes'>+{sta[1].data.routes.length-10}</code>
                      : (sta[1].data.routes.length == 11  && ' ' + sta[1].data.routes[10].routeName)
                    }
                  </div>
                </summary>
                <ul>
                  {
                    sta[1].data.routes.slice(0,props.routesShowing).map(route => 
                    <li className={`bus-block ${route.color.toLowerCase()}`} key={route.routeName + '-' + route.direction + '-' + route.stationIndex}>
                      <div style={{fontSize: '2rem'}} className={`route-name big-bus ${route.color.toLowerCase()}`}>{route.routeName}</div>
                      <div className='to-station'><span style={{whiteSpace: 'nowrap'}}>前往</span><span style={{fontWeight: 'bold', fontSize: '1.2em', display: '-webkit-inline-box', overflow: 'hidden', textOverflow: 'ellipsis', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical'}}>{route.directionF}</span></div>
                      <button className='btn btn-success' onClick={
                        () => {
                          props.requestRoute(route.routeName,route.color.toLowerCase(),true,route.direction,route.stationIndex,null,true);
                        }
                      } style={
                        {
                          minWidth: 'fit-content',
                          marginLeft: 'auto',
                          color: 'white',
                        }
                      }>{stationRTData?.[sta[0]]?.[`${route.routeName}-${route.direction}`]?.[0]?.stopsRemaining != null ?
                        <span style={{fontWeight: 'bold', color: 'white', fontSize: '1.25rem', fontFamily: 'Montserrat, sans-serif'}}>
                          <svg style={{color: 'white'}} xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-broadcast" viewBox="0 0 16 16">
                            <path style={{color: 'white'}} d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707zm2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708zm5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708zm2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
                          </svg>
                          &nbsp;{stationRTData?.[sta[0]]?.[`${route.routeName}-${route.direction}`]?.[0]?.stopsRemaining > 0 ? `${stationRTData?.[sta[0]]?.[`${route.routeName}-${route.direction}`]?.[0]?.stopsRemaining} 站` : (stationRTData?.[sta[0]]?.[`${route.routeName}-${route.direction}`]?.[0]?.currentStation === 0 ? '即將發車' : '到達')}
                        </span>
                        : '未發車'}</button>
                    </li>
                    )
                  }
                </ul>
                {
                  sta[1].data.routes.length > props.routesShowing &&
                  <div className='btn other-routes' onClick={() => props.setNumberOfRoutesShowing(props.routesShowing + 5)}>查看此站另外 {Math.min(sta[1].data.routes.length - props.routesShowing, 5)} 條路線...</div>
                }
              </details>
            })
            : <div className='no-station'>附近沒有任何車站</div>
          }
          </div>
      //   : 
      //   <div className='main-list'>
      //     <details>
      //       <summary>favorite_station</summary>
      //     </details>
      //     <details>
      //       <summary>favorite_station</summary>
      //     </details>
      //     <details>
      //       <summary>favorite_station</summary>
      //     </details>
      //     <details>
      //       <summary>favorite_station</summary>
      //     </details>
      //     <details>
      //       <summary>favorite_station</summary>
      //     </details>
      //   </div>
      }
    </div>
  )
}

function ZoomTooSmallNotifs(props) {
  return (
    <div className={`notifs text-center${props.isZoomTooSmall ? ' shown' : ''}`}>
      <div className='notifs-container'>
        <p>放大地圖以查看巴士站</p>
      </div>
    </div>
  );
}

export default StationView;