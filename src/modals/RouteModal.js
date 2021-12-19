import { useState, useEffect, useRef, useCallback } from 'react';
import AppData from '../AppData'
import * as helpers from '@turf/helpers'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import bbox from '@turf/bbox';
import mapboxgl from '!mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import 'mapbox-gl/dist/mapbox-gl.css'
import './RouteModal.css'
import { disableBodyScroll } from 'body-scroll-lock';
import { isLineOnLine } from '@turf/boolean-contains';

function RouteModal(props) {
  let mapShowBig = false;

  let intervals = [];
  let fetchController = new AbortController();
  const bridgeCoords = {
    '01': [[[
      [113.5608566,22.2047643],
      [113.5626161,22.1991966],
      [113.5631847,22.1668194],
      [113.5639894,22.1667598],
      [113.5635924,22.1992066],
      [113.5614681,22.2048289],
      [113.5608566,22.2047643]
    ]],4500],
    '02': [[[
      [113.5437709,22.18665],
      [113.548556,22.1652893],
      [113.5487866,22.165329],
      [113.5441303,22.1866698],
      [113.5437709,22.18665]
    ]],2540],
    '03': [[[
      [113.5322535,22.1784935],
      [113.5388947,22.165945],
      [113.5396671,22.1664617],
      [113.5337448,22.1786227],
      [113.5322535,22.1784935]
    ]],2000],
  };
  let bridgeRoute = {};
  let currentWarning = 0;
  let currentPopup = null;
  let isScrolling = null;
  let eventListenersFunc = [];
  let busLayerGroup = useRef([]);
  let stationLayerGroup = useRef([]);
  let settingUpBusLayer = false;
  let settingUpStationLayer = false;
  let settingUpRouteLayer = false;
  let isMapRefreshed = useRef(false);
  let routeMapData = useRef({
    'type': 'geojson',
    'data': {
      'type': 'FeatureCollection',
      'features': []
    },
  });

  const busMap = useRef(null);
  const [arrivingBuses, setArrivingBuses] = useState({});
  const [bridgeData, setBridgeData] = useState(null);

  const [busData, setBusData] = useState(null);
  const [busDirection, setBusDirection] = useState(0);
  const [closestStationIndex, setClosestStationIndex] = useState(null);
  const [currentOpenedIndex, setCurrentOpenedIndex] = useState(null);
  const [scrollToIndex, setScrollToIndex] = useState(null);
  const [scrollingToIndex, setScrollingToIndex] = useState(false);
  const [directionAvailable, setDirectionAvailable] = useState('2');
  const [gettingArrivingBuses, setGettingArrivingBuses] = useState(false);
  const [isMapEnabled, _setIsMapEnabled] = useState(false);
  const isMapEnabledRef = useRef(false);
  const setIsMapEnabled = (i) => {
    _setIsMapEnabled(i);
    isMapEnabledRef.current = i;
  }

  const [isDataReady, setIsDataReady] = useState({
    bridgeData: false,
    busData: false,
    locationData: false,
    routeData: false,
    routeTraffic: false,
  });
  const [onMount, setOnMount] = useState(true);
  const [isMapLoaded, _setIsMapLoaded] = useState(false);
  const isMapLoadedRef = useRef(false);
  const setIsMapLoaded = (i) => {
    _setIsMapLoaded(i);
    isMapLoadedRef.current = i;
  }
  const [isRouteChanged, setIsRouteChanged] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeTraffic, setRouteTraffic] = useState(null);
  const [tempRouteTraffic, setTempRouteTraffic] = useState(null);
  const [shown, setShown] = useState(false);
  const [liveState, setLiveState] = useState('station');
  const [resettingData, setResettingData] = useState(false);

  const [setupBusMarkersOnMap, setSetupBusMarkersOnMap] = useState(false);
  const [setupStationMarkersOnMap, setSetupStationMarkersOnMap] = useState(false);
  const [setupRoutesOnMap, setSetupRoutesOnMap] = useState(false);
  
  const [focusingStation, setFocusingStation] = useState(false);

  const busIconSrc = () => { return require(`../images/icons/${props.color.toLowerCase()}-bus-icon.png`).default };
  const lastBusIconSrc = () => { return require(`../images/icons/${props.color.toLowerCase()}-bus-icon-last.png`).default };

  const initMap = () => {
    let mapStyle = 'matthewngan/ckjzsnvju0uqx17o6891qzch5';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mapStyle = 'matthewngan/ckjzsftuo0uik17o62fm4oahc';
    }
    busMap.current = new mapboxgl.Map({
      container: 'route-bus-map',
      style: 'mapbox://styles/' + mapStyle, // stylesheet location
      center: [113.5622406,22.166422], // starting position [lng, lat]
      zoom: 11, // starting zoom
      minZoom: 10,
      maxZoom: 18.5,
      maxBounds: [[113.3157349,21.9111969],[113.7963867,22.4199152]],
      dragRotate: false,
      touchPitch: false,
    });
    busMap.current.touchZoomRotate.disableRotation();
  };
  const focusStationRef = useCallback(() => {
    if (!onMount && focusingStation && currentOpenedIndex != null) {
      if (isMapEnabled && areAllReady() && isMapLoaded) {
        const index = currentOpenedIndex;
        let stationLoc = [locationData.stationInfoList.slice()[index].longitude,locationData.stationInfoList.slice()[index].latitude];
        if (arrivingBuses[index] && arrivingBuses[index][0] && arrivingBuses[index][0].currentStation >= 0) {
          let closestBusLoc = arrivingBuses[index][0].location;
          let closestStationIndex = arrivingBuses[index][0].currentStation;
          let routeCoords = [stationLoc];
          for (let p of routeTraffic.slice(closestStationIndex, index).reverse()) {
            let b = false;
            for (let line of p.routeCoordinates.split(';').reverse()) {
              if (line.includes(',')) {
                let coords = [parseFloat(line.split(',')[0]),parseFloat(line.split(',')[1])];
                routeCoords.push(coords);
                if (b) break;
                if (coords[0] === closestBusLoc[0] && coords[1] === closestBusLoc[1]) {
                  b = true;
                }
              }
            }
            if (b) break;
          }
          let abbox = bbox(helpers.lineString(routeCoords));
          let padding = document.querySelector('#' + props.id + ' #route-bus-map').offsetHeight * 0.1;
          busMap.current.fitBounds(abbox, {padding: padding, maxZoom: 16});
          console.log(routeMapData, index, closestStationIndex);
          if (routeMapData.current) {
            for (let [i,features] of routeMapData.current.data.features.slice().entries()) {
              if (i >= index || i < closestStationIndex) {
                features.properties.opacity = 0.25;
              } else {
                features.properties.opacity = 1;
              }
            }
            if (busMap.current.getSource('route') != null) busMap.current.getSource('route').setData(routeMapData.current.data);
          }
          for (let i = 0; i < stationLayerGroup.current.length; i++) {
            if (i > index || i < closestStationIndex) {
              stationLayerGroup.current.slice().reverse()[i].getElement().style.opacity = 0;
            } else if (i === index || i === closestStationIndex) {
              stationLayerGroup.current.slice().reverse()[i].getElement().style.opacity = 1;
            }
            else {
              stationLayerGroup.current.slice().reverse()[i].getElement().style.removeProperty('opacity');
            }
          }
          let busPlateWithSameDistance = [];
          for (let arrivingBus of  arrivingBuses[index].slice()){
            if (index - arrivingBus.currentStation === index - arrivingBuses[index][0].currentStation) {
              busPlateWithSameDistance.push(arrivingBus.plate);
            }
          }
          let busElementGoingToShow = [...document.querySelectorAll('.route-bus-marker')].filter(bus => {
            return busPlateWithSameDistance.includes(bus.id.replace('bus-',''));
          });
          for (let busElement of document.querySelectorAll('.route-bus-marker')) {
            if (!busElementGoingToShow.includes(busElement)) {
              busElement.style.setProperty('visibility', 'hidden');
            } else {
              busElement.style.removeProperty('visibility');
            }
          }
        } else {
          if (stationLoc[0] != null && stationLoc[1] != null) {
            busMap.current.flyTo({
              center: stationLoc,
              zoom: 15.5,
            });
          }
          if (routeMapData.current) {
            for (let features of routeMapData.current.data.features.slice()) {
              features.properties.opacity = 1;
            }
            busMap.current.getSource('route').setData(routeMapData.current.data);
          }
          for (let i = 0; i < stationLayerGroup.current.length; i++) {
            stationLayerGroup.current.slice().reverse()[i].getElement().style.removeProperty('opacity');
          }
          for (let busElement of document.querySelectorAll('.route-bus-marker')) {
            busElement.style.removeProperty('visibility');
          }
        }
      }
    } else {
      currentPopup = null;
      if (isMapEnabled && isMapLoaded) {
        for (let layer of stationLayerGroup.current) layer.getElement().style.removeProperty('opacity');
        if (routeMapData.current != null) {
          console.log('is this it?')
          for (let feature of routeMapData.current.data.features) feature.properties.opacity = 1;
          busMap.current.getSource('route').setData(routeMapData.current.data);
        }
        for (let busElement of document.querySelectorAll('.route-bus-marker')) {
          busElement.style.removeProperty('visibility');
        }
      }
    }
  });

  const areAllReady = () => {
    let a = true;
    for (let r of Object.values(isDataReady)) if (!r) a = false;
    return a;
  }

  const changeDirection = () => {
    fetchController.abort();
    fetchController = new AbortController();
    const changeDirectionIcon = document.querySelector('#route-changedirection-icon');
    if (changeDirectionIcon) changeDirectionIcon.disabled = true;
    setTimeout(() => {
      const changeDirectionIcon = document.querySelector('#route-changedirection-icon');
      if (changeDirectionIcon) changeDirectionIcon.disabled = false;
    }, 5000);
    const details = document.querySelectorAll('details') || [];
    for (let detail of details) {
      detail.removeAttribute('open')
    }
    bridgeRoute = {};
    setIsDataReady = {
      busData: false,
      bridgeData: false,
      locationData: false,
      routeData: false,
      routeTraffic: false,
    };
    setBusDirection(busDirection === 0 ? 1 : 0);
    setRouteTraffic(null);
    setRouteData(null);
    setBusData(null);
    setScrollToIndex(null);

    for (let marker of busLayerGroup.current) marker.remove();
    busLayerGroup.current = [];
    for (let marker of stationLayerGroup.current) marker.remove();
    stationLayerGroup.current = [];
    if (isMapEnabled && isMapLoaded && busMap.current.getLayer('route')) {
      busMap.current.removeLayer('route');
      busMap.current.removeSource('route');
    }

    setSetupStationMarkersOnMap(true);
    setSetupBusMarkersOnMap(true);
    setSetupRoutesOnMap(true);

    if (isMapLoaded && isMapEnabled && document.querySelector('.route-bus-info-container')) {
      document.querySelector('.route-bus-info-container').setAttribute('style','');
    }

    setScrollingToIndex(true);

  }

  useEffect(() => {
    if (!onMount) {
      fetchBusData();
      fetchRouteData();
      fetchTrafficData();
    }
  }, [busDirection]);

  useEffect(() => {
    if (!onMount && areAllReady() && scrollingToIndex) {
      if (scrollToIndex != null) {
        let container = (isMapEnabled && isMapLoaded) ? document.querySelector('.route-bus-info-container') : document.querySelector('.route-modal');
        let targetParent = document.querySelectorAll('.route-traffic')[scrollToIndex];
        let scrollTarget = document.querySelectorAll('.route-traffic')[Math.max(scrollToIndex-3,0)];
        targetParent.parentNode.open = true;
        if (isMapEnabled && isMapLoaded) {
          container.scroll({
            top: targetParent.offsetTop - document.querySelector('.route-navbar').offsetHeight, behavior: 'smooth',
          })
        } else {
          container.scroll({
            top: scrollTarget.offsetTop + document.querySelector('.route-bus-title').offsetHeight, behavior: 'smooth',
          })
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(scrollToNearest, () => {}, {
          enableHighAccuracy: true,
          maximumAge: 0,
        });
      }
      setScrollingToIndex(false);
    }
  }, [scrollingToIndex, isDataReady])

  useEffect(() => {
    if (!onMount && !(busMap instanceof mapboxgl.Map)) setIsMapLoaded(false);
  }, [busMap]);

  useEffect(() => {
    if (!onMount) {
      localStorage.isRouteMapEnabled = isMapEnabled;
      if (!isMapEnabled) {
        if (isMapLoaded) busMap.current.remove();
        busMap = null;
        busLayerGroup.current = [];
        stationLayerGroup.current = [];
        document.querySelector('.route-bus-info-container')?.setAttribute('style', '');
        let thisTop = document.querySelector('.route-navbar').offsetTop;
        let titleHeight = document.querySelector('.route-bus-title').offsetHeight;
        document.querySelector('.route-navbar').classList.toggle('stuck', thisTop > titleHeight);
      } else if (isMapEnabled) {
        isMapRefreshed.current = false;
        initMap();
        busMap.current.on('zoom', () => {
          if (busMap.current.getZoom() > 14) {
            if (!mapShowBig) {
              for (let mapStation of document.querySelectorAll('.route-map-station:not(.important)')) {
                mapStation.classList.toggle('shown',true);
              }
              for (let mapImportantStationText of document.querySelectorAll('.destination span, .origin span')) {
                mapImportantStationText.classList.toggle('shown',true);
              }
              for (let busMarker of document.querySelectorAll('.route-bus-marker')) {
                busMarker.style.width = (busMap.current.getZoom() + 3).toString() + 'px';
                busMarker.style.height = (busMap.current.getZoom() + 3).toString() + 'px';
              }
              if (busMap.current.getLayer('route')) busMap.current.setPaintProperty('route', 'line-width', 4);
              mapShowBig = true;
            }
          } else {
            if (mapShowBig) {
              for (let mapStation of document.querySelectorAll('.route-map-station:not(.important)')) {
                mapStation.classList.toggle('shown',false);
              }
              for (let mapImportantStationText of document.querySelectorAll('.destination span, .origin span')) {
                mapImportantStationText.classList.toggle('shown',false);
              }
              for (let busMarker of document.querySelectorAll('.route-bus-marker')) {
                busMarker.style.width = '14px';
                busMarker.style.height = '14px';
              }
              if (busMap.current.getLayer('route')) busMap.current.setPaintProperty('route','line-width',2);
              mapShowBig = false;
            }
          }
        });;
        busMap.current.on('load', () => setIsMapLoaded(true));
        busMap.current.on('styledata', () => {
          setSetupRoutesOnMap(true);
        });
        setSetupStationMarkersOnMap(true);
        setSetupBusMarkersOnMap(true);
        setSetupRoutesOnMap(true);
        document.querySelector('.route-bus-info-container').setAttribute('style', '');
        document.querySelector('.route-modal').scroll({top: 0});
        document.querySelector('.route-modal').style.setProperty('--title-offset-top',`${document.querySelector('.route-bus-title').offsetTop}px`);
      }
    }
  }, [isMapEnabled]);

  const fetchBusData = () => {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/bus?routeName=${props.route}&dir=${busDirection}`,{signal: fetchController.signal})
      .then(response => response.json())
      .then(data => {
        props.handleNetworkError(false);
        data.data.routeName = props.route;
        setBusData(data.data);
      })
      .catch(error => {
        console.log(error);
        if (error instanceof TypeError) {
          setIsDataReady(prevState => ({
            ...prevState,
            busData: false
          }))
          props.handleNetworkError(true);
        }
      });
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/location?routeName=${props.route}&dir=${busDirection}&lang=zh-tw`,{signal: fetchController.signal})
      .then(response => {
        if(response.status >= 200 && response.status < 300) {
            return response.json();
        } else {
            throw new Error('Server/Network Error: ' + response.status);
        }
      })
      .then(data => {
        props.handleNetworkError(false);
        data.data.routeName = props.route;
        setLocationData(data.data);
      })
      .catch(error => {
        console.log(error);
        if (error instanceof TypeError) {
          setIsDataReady(prevState => ({
            ...prevState,
            locationData: false
          }))
          props.handleNetworkError(true);
        }
      });
  }

  const fetchRouteData = () => {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html?routeName=${props.route}&dir=${busDirection}&lang=zh-tw`,{signal: fetchController.signal})
      .then(response => {
        if(response.status >= 200 && response.status < 300) {
            return response.json();
        } else {
            throw new Error('Server/Network Error: ' + response.status);
        }
      })
      .then(data => {
        props.handleNetworkError(false);
        for (let i = 0; i < data.data.routeInfo.length-2; i++) {
          if (data.data.routeInfo.slice()[i].staCode[0] != data.data.routeInfo.slice()[i+1].staCode[0] && data.data.routeInfo.slice()[i].staCode[0] != 'C' && data.data.routeInfo.slice()[i+1].staCode[0] != 'C') {
            bridgeRoute[i] = [data.data.routeInfo.slice()[i].staCode[0],data.data.routeInfo.slice()[i+1].staCode[0]];
          }
        }
        data.data.routeName = props.route;
        if (props.route === "MT3" ) {
          data.data.routeInfo[0].laneName = 'A 車道';
          data.data.routeInfo[25].laneName = 'A 車道';
        }
        if (props.route === "27" ) {
          data.data.routeInfo[0].laneName = 'B 車道';
          data.data.routeInfo[25].laneName = 'B 車道';
        }
        setRouteData(data.data);
        setDirectionAvailable(data.data.direction);
        setIsRouteChanged(data.data.routeInfo.filter(sta => sta.suspendState === '1').length != 0);
      })
      .catch(error => {
        console.log(error);
        if (error instanceof TypeError) {
          setIsDataReady(prevState => ({
            ...prevState,
            routeData: false,
          }));
          props.handleNetworkError(true);
        }
      });
  };

  const fetchTrafficData = () => {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37011/its/Bridge/getTime.html?lang=zh_tw`,{signal: fetchController.signal})
      .then(response => {
        if(response.status >= 200 && response.status < 300) {
            return response.json();
        } else {
            throw new Error('Server/Network Error: ' + response.status);
        }
      })
      .then(data => {
        props.handleNetworkError(false);
        setBridgeData(data.data.timeArray);
      })
      .catch(error => {
        console.log(error);
        if (error instanceof TypeError) {
          setIsDataReady(prevState => ({
            ...prevState,
            bridgeData: false,
          }));
          props.handleNetworkError(true);
        }
      });
    
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/ddbus/common/supermap/route/traffic?routeCode=${'0'.repeat(5-props.route?.length) + props.route}&direction=${busDirection}&indexType=00&device=web`,{signal: fetchController.signal})
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json();
      } else {
          throw new Error('Server/Network Error: ' + response.status);
      }
    })
    .then(data => {
      props.handleNetworkError(false);
      data.data.routeName = props.route;
      setTempRouteTraffic(data.data);
    })
    .catch(error => {
      console.log(error);
      if (error instanceof TypeError) {
        setIsDataReady(prevState => ({
          ...prevState,
          routeTraffic: false,
        }));
        props.handleNetworkError(true);
      }
    });
  }
  useEffect(() => {
    if (!onMount && routeData != null && busData != null && tempRouteTraffic != null && Object.keys(tempRouteTraffic).length > 0) {
      let tempdata = tempRouteTraffic;
      // let jamRouteIndex = busData.routeInfo.findIndex((sta) => sta.staCode.includes('M84'));
      // if (jamRouteIndex > -1) {
      //   jamRouteIndex -= 1;
      //   tempdata[jamRouteIndex].routeTraffic = Math.max(2,Math.pow(parseInt(tempdata[jamRouteIndex].routeTraffic),2));
      // }
      // if (props.route === '32') {
      //   let cloneRouteIndex = busData.routeInfo.findIndex((sta) => sta.staCode.includes('M254/1'));
      //   if (cloneRouteIndex > -1) {
      //     cloneRouteIndex -= 1;
      //     tempdata[cloneRouteIndex].realTraffic = parseInt(tempdata[cloneRouteIndex].routeTraffic) / 8
      //   }
      // }
      for (let route in bridgeRoute) {
        let direction = null;
        if (bridgeRoute[route][0] === 'T') {
          direction = 0;
        } else {
          direction = 1;
        }
        let onbridge = null;
        for (let point of tempdata.slice()[parseInt(route)].routeCoordinates.split(';')) {
          if (point != '') {
            let loc = point.split(',');
            for (let id in bridgeCoords) {
              let poly = helpers.polygon(bridgeCoords[id][0]);
              let pt = helpers.point([parseFloat(loc[0]),parseFloat(loc[1])]);
              if (booleanPointInPolygon(pt,poly)) {
                onbridge = id;
                break;
              }
            }
            if (onbridge != null) {
              break;
            }
          }
        }
        let timeToCrossBridgeInSec = parseInt(bridgeData.slice()[direction].times.filter(bridge => bridge.id === onbridge)[0].time);
        if (timeToCrossBridgeInSec > -1) {
          let speed = (bridgeCoords[onbridge].slice()[1] / timeToCrossBridgeInSec * 3.6) > 52 ? 52 : bridgeCoords[onbridge].slice()[1] / timeToCrossBridgeInSec * 3.6;
          let traffic = 1 / (speed / 3.6 * 60 / 750);
          tempdata[parseInt(bridgeRoute)].routeTraffic = traffic.toString();
        }
      }
      setRouteTraffic(tempdata);
    }
  }, [tempRouteTraffic, routeTraffic, routeData, busData])

  useEffect(() => {
    focusStationRef();
  }, [focusingStation, isDataReady, currentOpenedIndex]);

  // const getArrivingBuses = (index = currentOpenedIndex) => {
  //   if (index != null) {
  //     setGettingArrivingBuses(true);
  //   }
  // }

  useEffect(() => {
    if (routeData?.routeInfo != null && routeTraffic != null) {
      let busList = [];
      for (let index in routeData.routeInfo) {
        let tempArr = busList.slice(Math.max(busList.length-3,0),Math.max(busList.length,0)).reverse();
        setArrivingBuses(prevState => ({
          ...prevState,
          [index]: tempArr,
        }));
        let busInfoLocations = locationData.busInfoList;
        if (busInfoLocations?.length > 0 && busData.routeInfo?.length > index) {
          for (const comingBus of busData.routeInfo[index].busInfo) {
            try {
              const thisRouteTraffic = routeTraffic[index].routeTraffic;
              const bus = busInfoLocations.filter(bus => bus.busPlate === comingBus.busPlate)[0];
              const busLoc = [parseFloat(bus.longitude),parseFloat(bus.latitude)];
              const speed = locationData.busInfoList.filter(item => item.busPlate === comingBus.busPlate)[0].speed;
              busList.push({
                'plate': `${comingBus.busPlate.substring(0,2)}-${comingBus.busPlate.substring(2,4)}-${comingBus.busPlate.substring(4,6)}`,
                'speed': speed,
                'routeTraffic': thisRouteTraffic,
                'location': busLoc,
                'currentStation': parseInt(index),
              })
            } catch {}
          }
          setFocusingStation(true);
        }
      }
      setGettingArrivingBuses(false);
    }
  }, [gettingArrivingBuses, routeTraffic, locationData]);

  
  useEffect(() => {if (!onMount) setIsDataReady(prevState => ({
    ...prevState,
    busData: true,
  }))}, [busData]);
  useEffect(() => {if (!onMount) setIsDataReady(prevState => ({
    ...prevState,
    locationData: true,
  }))}, [locationData]);
  useEffect(() => {if (!onMount) setIsDataReady(prevState => ({
    ...prevState,
    routeData: true,
  }))}, [busData]);
  useEffect(() => {if (!onMount) setIsDataReady(prevState => ({
    ...prevState,
    routeTraffic: true,
  }))}, [routeTraffic]);
  useEffect(() => {if (!onMount) setIsDataReady(prevState => ({
    ...prevState,
    bridgeData: true,
  }))}, [busData]);

  // const setDetailClickEvent = () => {
  //   if (!onMount) {
  //     const details = document.querySelectorAll('.route-modal details');
  //     if (details.length > 0)
  //       for (let targetDetail of details) {
  //         targetDetail.addEventListener('click', () => {
  //           for (let detail of details) {
  //             if (detail !== targetDetail)
  //               detail.removeAttribute('open');
  //           }
  //         });
  //       }
  //     else {
  //       setTimeout(() => setDetailClickEvent(), 1);
  //     }
  //   }
  // }

  // useEffect(() => setDetailClickEvent(),[routeData]);

  // const observer = new MutationObserver(setDetailClickEvent);
  // useEffect(() => {
  //   observer.observe(document.querySelector('.route-bus-info-container'), {
  //     attributes: true,
  //     childList: true,
  //     subtree: true,
  //   });
  // },[]);

  useEffect(() => {
    if (!onMount && isMapLoaded) {
    }
  }, [busMap])

  const removeInterval = () => {
    for (let interval of intervals) {
      clearInterval(interval);
    }
    intervals = [];
  }

  const resetMap = () => {
    busMap.current.setCenter([113.5622406,22.166422]);
    busMap.current.setZoom(11);
    document.querySelector('#route-bus-map')?.setAttribute('style','');
    document.querySelector('.mapboxgl-canvas')?.setAttribute('style','');
    busMap.current.resize();
    if (stationLayerGroup.current != []) {
      for (let marker of stationLayerGroup.current) {
        marker.remove();
      }
    }
    stationLayerGroup.current = [];
    if (busLayerGroup.current != []) {
      for (let marker of busLayerGroup.current) {
        marker.remove();
      }
    }
    busLayerGroup.current = [];
    if (busMap.current.getLayer('route')) {
      busMap.current.removeLayer('route');
      busMap.current.removeSource('route');
    }
    isMapRefreshed.current = false;
  }

  const scrollToNearest = (pos) => {
    let coords = pos.coords;
    let closestStation = 0;
    let closestDistance = 999999;
    for (let [index, station] of locationData.stationInfoList.entries()) {
      let distance = props.calculateDistance(station.longitude, station.latitude, coords.longitude, coords.latitude);
      if (distance < closestDistance) {
        closestStation = index; closestDistance = distance;
      }
    }
    setClosestStationIndex(closestStation);
  }

  useEffect(() => {
    if (!onMount && closestStationIndex != null) {
      const closestStation = closestStationIndex;
      let container = (isMapEnabled && isMapLoaded) ? document.querySelector('.route-bus-info-container') : document.querySelector('.route-modal');
      let targetParent = document.querySelectorAll('.route-traffic')[closestStation];
      let scrollTarget = document.querySelectorAll('.route-traffic')[Math.max(closestStation-3,0)];
      if (targetParent != null) {
        targetParent.parentNode.open = true;
        container.scroll({
          top: 
            (isMapEnabled && isMapLoaded)
              ? targetParent.offsetTop - document.querySelector('.route-navbar').offsetHeight
              : scrollTarget.offsetTop + document.querySelector('.route-bus-title').offsetHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [closestStationIndex]);

  const setFocusRef = useRef((a) => setFocusingStation(a));
  useState(() => {
    setFocusRef.current = (a) => {
      setFocusingStation(a);
    };
  })

  const requestRoute = () => {
    fetchController = new AbortController();
    setClosestStationIndex(null);
    if (isMapEnabled && isMapLoaded) {
      initMap();
    }
    disableBodyScroll(document.querySelector('#' + props.id));
    let scrollEventFunc = () => {
      if (!isMapLoadedRef.current && !isMapEnabledRef.current && document.querySelector('#' + props.id + ' .route-bus-title')) {
        let thisTop = document.querySelector('#' + props.id + ' .route-navbar').offsetTop;
        let titleHeight;
        if (isMapEnabledRef.current) titleHeight = document.querySelector('#' + props.id + ' .route-bus-title').offsetHeight + document.querySelector('#' + props.id + ' #route-bus-map').offsetHeight;
        else titleHeight = document.querySelector('#' + props.id + ' .route-bus-title').offsetHeight
        document.querySelector('#' + props.id + ' .route-navbar').classList.toggle('stuck', thisTop > titleHeight);
      } else {
        document.querySelector('#' + props.id + ' .route-navbar').classList.toggle('stuck', false);
      }
      if (isMapLoadedRef.current && isMapEnabledRef.current) {
        // document.querySelector('#' + props.id).style.setProperty('--title-offset-top',`${document.querySelector('#' + props.id + ' .route-bus-title').offsetTop}px`);
        busMap.current.easeTo({
          padding: {
            bottom: document.querySelector('#' + props.id).scrollTop,
          },
          duration: 0,
        })
        if (isScrolling) clearTimeout(isScrolling);
        isScrolling = setTimeout(() => {
          if (isMapLoadedRef.current && isMapEnabledRef.current) {
            focusStationRef();
          }
        }, 66);
      }
    }
    eventListenersFunc.push(['scroll', '#' + props.id, scrollEventFunc]);
    document.querySelector('#' + props.id).addEventListener('scroll',scrollEventFunc);
    document.querySelector('#' + props.id).scrollTop = 0;

    let dataInterval = setInterval(() => {
      fetchBusData();
      setSetupBusMarkersOnMap(true);
    }, 5000);
    let trafficInterval = setInterval(() => {
      fetchTrafficData();
      setSetupRoutesOnMap(true);
    }, 15000);
    let liveStateInterval = setInterval(() => {
      if (liveState === 'speed') setLiveState('station');
      else setLiveState('speed');
    }, 7500);
    intervals = [dataInterval, trafficInterval, liveStateInterval];
    setScrollingToIndex(true);
  }

  const scrollToWarning = () => {
    let container = (isMapEnabled && isMapLoaded) ? document.querySelector('.route-bus-info-container') : document.querySelector('.route-modal');
    let suspendedParent = document.querySelectorAll('.route-suspended')[currentWarning].parentNode;
    let top;
    if (isMapEnabled && isMapLoaded) {
      top = suspendedParent.offsetTop - document.querySelector('.route-navbar').offsetHeight;
    } else {
      top = suspendedParent.offsetTop + document.querySelector('.route-bus-title').offsetHeight;
    }
    container.scroll({top: top, behavior: 'smooth'});
    let suspendedStations = routeData.routeInfo.filter(station => station.suspendState === '1');
    if (currentWarning === suspendedStations.length - 1) currentWarning = 0;
    else if (suspendedStations.length !== 0) currentWarning++;
  }

  useEffect(() => {
    if (isMapLoaded && locationData != null) {
      if (stationLayerGroup.current.length === 0) {
        for (let [index, station] of locationData.stationInfoList.slice().reverse().entries()) {
          let stationElement, stationTextElement;
          stationElement = document.createElement('div');
          stationElement.classList.add('route-map-station');
          if (index === locationData.stationInfoList.length - 1) {
            stationTextElement = document.createElement('span');
            stationTextElement.innerHTML = routeData.routeInfo.reverse()[index].staName;
            stationElement.classList.add('important');
            stationElement.classList.add('origin');
            stationElement.appendChild(stationTextElement);
          } else if (index === 0) {
            stationTextElement = document.createElement('span');
            stationTextElement.innerHTML = routeData.routeInfo.reverse()[index].staName;
            stationElement.classList.add('important');
            stationElement.classList.add('destination');
            stationElement.appendChild(stationTextElement);
          } else if (AppData.mainStations.includes(routeData.routeInfo.reverse()[index].staCode.split('/')[0]))
            stationElement.classList.add('important');
          else {
            if (busMap.current.getZoom() <= 13.5) stationElement.classList.toggle('shown',false);
            else stationElement.classList.toggle('shown', true);
          }
          stationElement.addEventListener('hover', () => busMap.current.getCanvas().style.cursor = 'pointer');
          stationElement.addEventListener('click', (e) => {
            const details = document.querySelectorAll('.route-bus-info details');
            for (let detail of details) detail.removeAttribute('open');
            currentPopup = locationData.stationInfoList.slice().length - index - 1;
            details[locationData.stationInfoList.length - index - 1].open = true;
            document.querySelector('.route-bus-info-container').scroll({
              top: (1.5 * parseFloat(getComputedStyle(document.documentElement).fontSize) + 30)*(locationData.stationInfoList.slice().length - index - 1),
              behavior: 'smooth'
            });
          });
          let stationPopup = new mapboxgl.Popup({
            closeButton: false,
            offset: 8,
          }).setText(
            `${routeData.routeInfo.reverse()[index].staCode} ${routeData.routeInfo.reverse()[index].staName}`
          );
          stationPopup.on('close', () => setFocusingStation(false));
          let stationMarker = new mapboxgl.Marker(stationElement).setLngLat([
            parseFloat(station?.longitude), parseFloat(station?.latitude)]).setPopup(stationPopup).addTo(busMap.current);
          stationLayerGroup.current.push(stationMarker);
        }
      }
    }
  }, [busMap, isMapLoaded, locationData]);
  useEffect(() => {
    if (!onMount && isMapLoaded && setupBusMarkersOnMap && locationData != null) {
      if (busLayerGroup.current.length > 0) 
        for (let marker of busLayerGroup.current) marker.remove();
      busLayerGroup.current = [];
      for (let bus of locationData.busInfoList.filter(bus => bus.speed > -1)) {
        let busElement = document.createElement('img');
        if (bus.busPlate === busData.lastBusPlate) busElement.src = lastBusIconSrc();
        else busElement.src = busIconSrc();
        busElement.classList.add('route-bus-marker');
        busElement.id = `bus-${bus.busPlate.substring(0,2)}-${bus.busPlate.substring(2,4)}-${bus.busPlate.substring(4,6)}`;
        for (let sta of busData.routeInfo) {
          for (let lbus of sta.busInfo) {
            if (lbus.busPlate === bus.busPlate && lbus.status === '0') {
              busElement.classList.toggle('moving',true);
              break;
            }
          }
          if (busElement.classList.contains('moving')) break;
        }
        const mapZoom = busMap.current.getZoom();
        if (mapZoom <= 14) {
          busElement.style.width = '14px';
          busElement.style.height = '14px';
        } else {
          busElement.style.width = (mapZoom + 1.5).toString() + 'px';
          busElement.style.height = (mapZoom + 1.5).toString() + 'px';
        }
        let focusing = false;
        if (arrivingBuses[currentOpenedIndex] != null) {
          for (let bus of arrivingBuses[currentOpenedIndex]) {
            if (!focusing) focusing = (busElement.id.includes(bus.plate)) && (currentOpenedIndex - bus.currentStation === currentOpenedIndex - arrivingBuses[currentOpenedIndex].currentStation);
            if (focusing) break;
          }
        }
        if (focusingStation && !focusing) busElement.style.setProperty('visibility', 'hidden');
        else busElement.style.removeProperty('visibility');
        let busPopup = new mapboxgl.Popup({
          closeButton: false, offset: 12
        }).setHTML(
          `<code class='${props.color.toLowerCase()}'>${bus.busPlate}</code>${parseInt(bus.speed) === -1 ? '' : ` ${bus.speed}km/h`}`
        );
        let busMarker = new mapboxgl.Marker(busElement).setLngLat([bus.longitude, bus.latitude]).setPopup(busPopup).addTo(busMap.current);
        busLayerGroup.current.push(busMarker);
      }
      setSetupBusMarkersOnMap(false);
    }
  }, [busMap, setupBusMarkersOnMap, locationData]);
  useEffect(() => {
    if (!onMount && isMapLoaded && setupRoutesOnMap && routeTraffic) {
      let allCoords = [];
      routeMapData.current.data.features = [];
      for (let i = 0; i < routeTraffic.length-1; i++) {
        if (routeTraffic[i].routeCoordinates) {
          let routeCoordinates = [];
          for (let routeCoordinate of routeTraffic[i].routeCoordinates.split(';')) {
            const coords = [parseFloat(routeCoordinate.split(',')[0]),parseFloat(routeCoordinate.split(',')[1])]
            routeCoordinates.push(coords);
            allCoords.push(coords);
          }
          let color;
          let traffic = Math.ceil(parseFloat(routeTraffic[i].routeTraffic));
          if (window.matchMedia('(prefers-color-scheme: dark)')?.matches) {
            if (traffic === 1) color = '#007400';
            else if (traffic === 2) color = '#5b7c00';
            else if (traffic === 3) color = '#817f00';
            else if (traffic === 4) color = '#7e4e00';
            else if (traffic >= 5) color = '#7e0f00';
            else color = '#3a576b';
          } else {
            if (traffic === 1) color = '#41a31a';
            else if (traffic === 2) color = '#8bb600';
            else if (traffic === 3) color = '#b7a610';
            else if (traffic === 4) color = '#d68400';
            else if (traffic >= 5) color = '#c70000';
            else color = '#67a1b7';
          }
          routeCoordinates.pop();
          let opacity = 1;
          let index = currentOpenedIndex;
          if (index != null && focusingStation && arrivingBuses?.[index]?.[0]) {
            let closestStationIndex = arrivingBuses[index][0].currentStation - 1;
            if (i >= index || i < closestStationIndex) opacity = 0.25;
          }
          routeMapData.current.data.features.push({
            'type': 'Feature',
            'properties': {
              'color': color,
              'opacity': opacity,
            },
            'geometry': {
              'type': 'LineString',
              'coordinates': routeCoordinates,
            }
          });
        }
      }
      if (busMap.current.getLayer('route') != null && busMap.current.getSource('route') != null)
        busMap.current.getSource('route').setData(routeMapData.current.data);
      else {
        busMap.current.addSource('route',routeMapData.current);
        busMap.current.addLayer({
          'id': 'route',
          'type': 'line',
          'source': 'route',
          'layout': {
            'line-join': 'round',
            'line-cap': 'round',
          },
          'paint': {
            'line-color': ['get','color'],
            'line-width': busMap.current.getZoom() > 14 ? 4 : 2,
            'line-opacity': ['get','opacity'],
          }
        });
      }
      if (!isMapRefreshed.current) {
        let routeLine = helpers.lineString(allCoords);
        let abbox = bbox(routeLine);
        busMap.current.fitBounds(abbox, {padding: 50});
        isMapRefreshed.current = true;
      }
      setSetupRoutesOnMap(false);
    }
  }, [isMapLoaded, setupRoutesOnMap, routeTraffic]);

  const toggleIndex = (index) => {
    let details = document.querySelectorAll('.route-bus-info details');
    if (currentPopup != null && stationLayerGroup.current.length > 0)
      stationLayerGroup.current.reverse()[currentPopup].getPopup().remove();
    if (details?.[index]?.hasAttribute('open')) {
      setCurrentOpenedIndex(index);
      for (let [i,detail] of Object.entries(details)) {
        if (parseInt(i) !== index) {
          detail.removeAttribute('open');
        }
      }
      setFocusingStation(true);
      if (isMapEnabled && busMap && stationLayerGroup.current.slice().reverse()[index] instanceof mapboxgl.Popup) {
        stationLayerGroup.current.slice().reverse()[index].getPopup().addTo(busMap.current);
        currentPopup = index;
      }
    } else {
      setTimeout(() => {
        let a = true;
        for (let elem of details) {
          if (elem.hasAttribute('open')) {
            a = false;
          }
        }
        if (a) setCurrentOpenedIndex(null);
      }, 10);
    }
  }

  useEffect(() => {
    let lme = false;
    if (props.isMapEnabled != null) lme = props.isMapEnabled;
    else if (localStorage.isRouteMapEnabled) lme = localStorage.isRouteMapEnabled === 'true';
    else localStorage.isRouteMapEnabled = 'false';
    setShown(props.shown);
    setBusDirection(props.direction != null ? props.direction : 0);
    setScrollToIndex(props.index);
    setOnMount(false);
    requestRoute();
    fetchRouteData();
    fetchBusData();
    fetchTrafficData();
    setIsMapEnabled(lme);
    if (lme) {
      setSetupStationMarkersOnMap(true);
      setSetupRoutesOnMap(true);
      setSetupBusMarkersOnMap(true);
    }

    return () => {
      fetchController.abort();
      removeInterval();
      bridgeRoute = {};
      currentWarning = 0;
      setCurrentOpenedIndex(null);
      setIsDataReady({
        bridgeData: false,
        busData: false,
        locationData: false,
        routeData: false,
        routeTraffic: false,
      });
      setArrivingBuses({});
      setBusData(null);
      setBusDirection(0);
      setDirectionAvailable('2');
      setLocationData(null);
      setRouteData(null);
      setRouteTraffic(null);
      setShown(false);
      setFocusingStation(false);
      busMap.current?.remove();
      busMap.current = null;
    }
  }, []);

  return (
    <div className={`modal route-modal shown`} id={props?.id}>
      <RouteModalHeader color={props.color} route={props.route} direction={busDirection} routeData={routeData} directionAvailable={directionAvailable}></RouteModalHeader>
      {isMapEnabled ? <div id='route-bus-map'></div> : null}
      <div className='route-main-info-container'>
        <div className='route-navbar'>
          <button onClick={() => props.returnHome()} className='col-auto btn' aria-label='Return Button'>
            <svg xmlns='http://www?.w3?.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-arrow-left' viewBox='0 0 16 16'>
              <path fillRule='evenodd' d='M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z'/>
            </svg>
          </button>
          {
            (routeData && !isMapEnabled) ?
            <div className='col row route-navbar-title'>
              <div className={`col-auto route-navbar-bus ${props.color.toLowerCase()}`}>
                <span>{props.route}</span>
              </div>
              <div className='route-header h5 col'>
                <span className='route-destination'>
                  {AppData.routeMainPoints[props.route?.toUpperCase()] ? AppData.routeMainPoints[props.route?.toUpperCase()][busDirection] : routeData?.routeInfo[0]?.staName}&nbsp;
                </span>
                <span className='route-destination'>
                  {
                    directionAvailable === '2' ?
                    <svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='currentColor' className='bi bi-arrow-repeat' viewBox='0 0 16 16'>
                      <path d='M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z'/>
                      <path fillRule='evenodd' d='M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z'/>
                    </svg>
                    : <svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='currentColor' className='bi bi-arrow-right' viewBox='0 0 16 16'>
                      <path fillRule='evenodd' d='M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z'/>
                    </svg>
                  }
                  &nbsp;{AppData.routeMainPoints[props.route?.toUpperCase()] ? AppData.routeMainPoints[props.route?.toUpperCase()]?.slice()?.reverse()[busDirection] : routeData?.routeInfo?.slice()?.reverse()[0]?.staName}
                </span>
              </div>
            </div>
            : null
          }
          <div className='route-option-buttons'>
            {
              directionAvailable === '0' &&
              <button onClick={() => changeDirection()} type='button' className='col-auto btn' id='route-changedirection-icon' aria-label='Change Direction Button'>
                <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-arrow-down-up' viewBox='0 0 16 16'>
                  <path fillRule='evenodd' d='M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5zm-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5z'/>
                </svg>
              </button>
            }
            {
              isRouteChanged && 
              <button className='btn' onClick={() => scrollToWarning()} aria-label='Scroll to warning button'>
                <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-exclamation-triangle-fill' viewBox='0 0 16 16'>
                  <path fillRule='evenodd' d='M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 5zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'/>
                </svg>
              </button>
            }
            {
              props?.mapSwitch && (isMapEnabled ?
              <button className='btn' onClick={() => setIsMapEnabled(false)} aria-label='Disable Map button'>
                <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-map-fill' viewBox='0 0 16 16'>
                  <path fillRule='evenodd' d='M16 .5a.5.5 0 0 0-.598-.49L10.5.99 5.598.01a.5.5 0 0 0-.196 0l-5 1A.5.5 0 0 0 0 1.5v14a.5.5 0 0 0 .598.49l4.902-.98 4.902.98a.502.502 0 0 0 .196 0l5-1A.5.5 0 0 0 16 14.5V.5zM5 14.09V1.11l.5-.1.5.1v12.98l-.402-.08a.498.498 0 0 0-.196 0L5 14.09zm5 .8V1.91l.402.08a.5.5 0 0 0 .196 0L11 1.91v12.98l-.5.1-.5-.1z'/>
                </svg>
              </button>
              : <button className='btn' onClick={() => setIsMapEnabled(true)} aria-label='Enable Map button'>
                  <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-map' viewBox='0 0 16 16'>
                    <path fillRule='evenodd' d='M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.502.502 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103zM10 1.91l-4-.8v12.98l4 .8V1.91zm1 12.98l4-.8V1.11l-4 .8v12.98zm-6-.8V1.11l-4 .8v12.98l4-.8z'/>
                  </svg>
                </button>)
            }
          </div>
        </div>
        <div className='row'>
          {
            (routeData) ?
            <div className='col route-bus-info-container'>
              <RouteStationBlock
                calculateTime={props.calculateTime}
                busIconSrc={busIconSrc}
                lastBusIconSrc={lastBusIconSrc}
                busData={busData}
                color={props.color}
                routeData={routeData}
                routeTraffic={routeTraffic}
                toggleIndex={toggleIndex}
                arrivingBuses={arrivingBuses}
                closestStationIndex={closestStationIndex}
                gettingArrivingBuses={gettingArrivingBuses}
                liveState={liveState}
              ></RouteStationBlock>
            </div>
            : <div className='route-loading route-bus-info-container'>載入中...</div>
          }
        </div>
      </div>
    </div>
  );
}

function RouteModalHeader(props) {

  const route = props.route;
  const routeData = props.routeData;
  const direction = props.direction;
  const directionAvailable = props.directionAvailable;
  const color = props.color;

  return (
    <div className='row ml-0 route-bus-title'>
      <div className={`bus col-auto ${color?.toLowerCase()}`}>
        <div className={route?.length > 2 ? 'h6' : 'h5'}>
          <span>{route}</span>
        </div>
      </div>
      {
        routeData != null ?
        <div className='h5 route-header col'>
          <span className='route-destination'>{AppData.routeMainPoints?.[route?.toUpperCase()]?.[direction] || routeData?.routeInfo?.[0]?.staName || ''}&nbsp;</span>
          <span className='route-destination'>
            {
              directionAvailable === '2' ?
              <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-arrow-repeat' viewBox='0 0 16 16'>
                <path d='M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z'/>
                <path fillRule='evenodd' d='M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z'/>
              </svg>
              : <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-arrow-right' viewBox='0 0 16 16'>
                <path fillRule='evenodd' d='M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z'/>
              </svg>
            }
            &nbsp;{AppData.routeMainPoints?.[route?.toUpperCase()]?.slice()?.reverse()[direction] || routeData?.routeInfo?.slice()?.reverse()[0]?.staName}
          </span>
        </div>
        : <div className='h5 route-header col'>
          <span className='route-destination'>
            載入中...
          </span>
        </div>
      }
      {
        route?.toLowerCase() === 'ap1x' ?
        <span className='col-auto text-muted'>機場<br/>快線</span>
        : (route?.toLowerCase()?.includes('ap') ?
          <span className='col-auto text-muted'>機場<br/>專線</span>
          : (route?.toLowerCase()?.includes('s') ? 
            <span className='col-auto text-muted'>特班車</span>
            : (route?.toLowerCase()?.includes('h') ? 
              <span className='col-auto text-muted'>醫院<br/>專線</span>
              : (route?.toLowerCase()?.includes('mt') ?
                <span className='col-auto text-muted'>澳氹<br/>專線</span>
                : (route?.toLowerCase()?.includes('n') ?
                  <span className='col-auto text-muted'>夜間<br/>巴士</span>
                  : (route?.toLowerCase()?.includes('x') ?
                    <span className='col-auto text-muted'>快線</span>
                    : null
                  )
                )
              )
            )
          )
        )
      }
    </div>
  );
}

function RouteStationBlock(props) {
  
  const arrivingBuses = props.arrivingBuses;
  const busIconSrc = props.busIconSrc();
  const lastBusIconSrc = props.lastBusIconSrc();
  const busData = props.busData;
  const color = props.color;
  const routeData = props.routeData.routeInfo;
  const routeTraffic = props.routeTraffic;
  const toggleIndex = props.toggleIndex;


  if (arrivingBuses != null
    && busIconSrc != null
    && lastBusIconSrc != null
    && busData != null
    && color != null
    && routeData != null
    && routeTraffic != null
    && toggleIndex != null
  ) {
    return (
      <div className='route-bus-info'>
        {
          busData.routeName === props.routeData.routeName && routeData.map((station,index) => {
            const busesAtStation = busData.routeInfo[index].busInfo.filter((bus) => bus.status === '1');
            const busesMoving = busData.routeInfo[index].busInfo.filter((bus) => bus.status === '0');
            return (
              <details key={index} onToggle={() => toggleIndex(index)}>
                {
                  <summary className={`route-traffic${index === routeData?.length - 1 ? ' last' : ''}${(parseFloat(routeTraffic?.[index]?.routeTraffic) <= 1 && parseFloat(routeTraffic?.[index]?.routeTraffic) > 0) ? ' green': ''}${Math?.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) === 2 ? ' yellow' : ''}${Math?.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) === 3 ? ' orange' : ''}${Math?.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) === 4 ? ' red' : ''}${Math?.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) >= 5 ? ' brown' : ''}`}>
                    <span className={
                      `route-station-dot${ busesAtStation.length > 0 ? ' hidden' : ''}`
                      }></span>
                    <span className='route-station-line'></span>
                    <span className='route-station-name'>
                      {station?.staCode} {station?.staName} {station?.laneName ?
                      <code className={`lane ${station?.staCode?.split('/')[0]} ${station?.laneName[0]}`}>{station?.laneName}</code>
                      : ''
                      } {index === props?.closestStationIndex ? <span>
                        <small className='text-muted'>最近的車站</small>
                      </span> : ''}
                    </span>
                    {
                      busesMoving.length > 0 &&
                      <span className={`route-station-bus-icon moving ${color.toLowerCase()}`}>
                          {
                            busesMoving.length > 1 ?
                            <span style={{ fontWeight: 'bold' }}>{busesMoving.length}</span>
                            : (busData?.lastBusPlate === busesMoving[0].busPlate ? <img src={lastBusIconSrc} /> : <img src={busIconSrc} />)
                          }
                      </span>
                    }
                    {
                      busesAtStation.length > 0 && 
                      <span className={`route-station-bus-icon ${color.toLowerCase()}`}>
                        {
                          busesAtStation.length > 1 ?
                          <span style={{ fontWeight: 'bold' }}>{busesAtStation.length}</span>
                          : (busData?.lastBusPlate === busesAtStation)[0]?.busPlate ? <img src={lastBusIconSrc} /> : <img src={busIconSrc} />
                        }
                      </span>
                    }
                    {
                      routeData?.[index]?.suspendState === '1' &&
                      <span className='route-suspended'>暫不停靠此站</span>
                    }
                  </summary>
                }
                <ul className='route-arriving-list'>
                  {
                    busData?.routeInfo?.[index]?.busInfo?.filter(bus => bus?.status === '1')?.map(bus => {
                      return (
                        <li key={bus?.busPlate}>
                          <span><code className={color?.toLowerCase()}>{bus?.busPlate?.substring(0,2)}-{bus?.busPlate?.substring(2,4)}-{bus?.busPlate?.substring(4,6)}</code></span>
                          {
                            index > 0 ?
                            <span className='route-time-remaining'>己進站</span>
                            : <span className='route-time-remaining'>即將發車</span>
                          }
                        </li>
                      )
                    })
                  }
                  {
                    arrivingBuses?.[index]?.slice()?.map((arrivingBus) => 
                      <li key={arrivingBus?.plate}>
                        <span><code className={color?.toLowerCase()}>{arrivingBus?.plate}</code> <small>{
                          props?.liveState === 'speed'
                            ? `車速 ${arrivingBus?.speed}km/h`
                            : (routeTraffic != null)
                              ? `距離 ${props.calculateTime(routeTraffic,arrivingBus.currentStation+1,index,arrivingBus.location)}`
                              : `載入中...`
                          }</small></span> 
                        <span className={
                          `route-time-remaining route-live${parseFloat(arrivingBus?.routeTraffic) <= 1 && parseFloat(arrivingBus?.routeTraffic) > 0 ? ' green' : ''}${Math?.ceil(parseFloat(arrivingBus?.routeTraffic)) === 2 ? ' yellow' : ''}${Math?.ceil(parseFloat(arrivingBus?.routeTraffic)) === 3 ? ' orange' : ''}${Math?.ceil(parseFloat(arrivingBus?.routeTraffic)) === 4 ? ' red' : ''}${Math?.ceil(parseFloat(arrivingBus?.routeTraffic)) >= 5 ? ' brown' : ''}`
                          }>
                          <svg xmlns='http://www?.w3?.org/2000/svg' width='14' height='14' fill='currentColor' className='bi bi-broadcast' viewBox='0 0 16 16'>
                            <path fillRule='evenodd' d='M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707zm2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 0 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708zm5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708zm2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707z'/>
                            <path d='M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'/>
                          </svg>
                          <span> { index - arrivingBus.currentStation } 站</span>
                          {/* {
                            arrivingBus?.duration > 30 ?
                            <span> {arrivingBus?.duration <= 3600 ? (Math?.round((arrivingBus?.duration) / 60)) + ' 分鐘' : '多於 ' + Math?.floor((arrivingBus?.duration) / 3600) + ' 小時'}</span>
                            : <span> 即將進站</span>
                          } */}
                        </span>
                      </li>
                    )
                  }
                  {
                    busData?.routeInfo?.[index]?.busInfo?.filter(bus => bus?.status === '0')?.map(bus => {
                      return (
                        <li key={bus?.busPlate} className='route-left'>
                          {bus?.busPlate === busData?.lastBusPlate ? <img src={lastBusIconSrc} /> : <img src={busIconSrc} />}
                          <span><code className={color?.toLowerCase()}>{bus?.busPlate?.substring(0,2)}-{bus?.busPlate?.substring(2,4)}-{bus?.busPlate?.substring(4,6)}</code></span>
                          <span className='route-time-remaining'>己離站</span>
                        </li>
                      )
                    })
                  }
                  {
                    (busesAtStation.length == 0 && (!arrivingBuses[index] || arrivingBuses[index]?.length === 0)) &&
                    (!props?.gettingArrivingBuses ? <li>未發車</li> : <li>計算中...</li>)
                  }
                </ul>
              </details>
            )
          }
        )
      }
      </div>
    );
  } else {
    return <div className='route-bus-info'></div>
  }
}

export default RouteModal;
