import React from 'react';
import AppData from '../AppData'
import PullToRefresh from 'pulltorefreshjs'
import * as helpers from '@turf/helpers'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import bbox from '@turf/bbox';
import mapboxgl from 'mapbox-gl/dist/mapbox-gl';
import { disableBodyScroll, clearAllBodyScrollLocks } from 'body-scroll-lock';
import './RouteView.css'

class RouteView extends React.Component {

  color = null;
  route = null;

  constructor(props) {
    super(props);
    this.state = {
      busList: [],
      noInternet: false,
      messages: [],
      currentModal: null,
      isModalVisible: false,
      shouldModalBeShown: false,
    }
  }
  
  calculateDistance(lon1,lat1,lon2,lat2){
    const R = 6371e3;
    const radlat1 = lat1 * Math.PI/180;
    const radlat2 = lat2 * Math.PI/180;
    const latD = (lat2-lat1) * Math.PI/180;
    const lonD = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(latD/2) * Math.sin(latD/2) +
              Math.cos(radlat1) * Math.cos(radlat2) *
              Math.sin(lonD/2) * Math.sin(lonD/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d;
  }

  calculateTime = (traffic,nextStop,targetStop,loc,bus) => {
    let totaldistance = 0;
    let currentRoutes = [];
    for (let i = 0; i < traffic[nextStop-1].routeCoordinates.split(';').length-1; i++) {
      currentRoutes.push({
        'x': parseFloat(traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[0]),
        'y': parseFloat(traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[1]),
      });
    }
    let index = currentRoutes.findIndex(point => point.x === parseFloat(loc[0]) && point.y === parseFloat(loc[1]));
    let thistraffic = parseFloat(traffic[nextStop-1].routeTraffic) > 0 ? parseFloat(traffic[nextStop-1].routeTraffic) : 1
    for (let i = index; i < traffic[nextStop-1].routeCoordinates.split(';').length-2; i++) {
      if (traffic[nextStop-1].routeCoordinates.split(';')[i] && traffic[nextStop-1].routeCoordinates.split(';')[i+1]) {
        let lon1 = traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[0];
        let lat1 = traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[1]
        let lon2 = traffic[nextStop-1].routeCoordinates.split(';')[i+1].split(',')[0];
        let lat2 = traffic[nextStop-1].routeCoordinates.split(';')[i+1].split(',')[1];
        totaldistance += this.calculateDistance(lon1,lat1,lon2,lat2)*thistraffic;
      }
    }
    // totaldistance += (bus.status === '1' ? 250 : 0)*traffic;
    totaldistance += bus.status === '1' ? 375 : 0;
    for (let route of traffic.slice(nextStop,targetStop)) {
      let thistraffic = parseFloat(route.routeTraffic) > 0 ? parseFloat(route.routeTraffic) : 1
      for (let i = 0; i < route.routeCoordinates.split(';').length-2; i++) {
        let lon1 = route.routeCoordinates.split(';')[i].split(',')[0]; let lat1 = route.routeCoordinates.split(';')[i].split(',')[1];
        let lon2 = route.routeCoordinates.split(';')[i+1].split(',')[0]; let lat2 = route.routeCoordinates.split(';')[i+1].split(',')[1];
        totaldistance += this.calculateDistance(lon1,lat1,lon2,lat2)*thistraffic;
      }
      // totaldistance += 250 * traffic;
      totaldistance += 375;
    }
    return Math.ceil(totaldistance / 12.5);
  }

  fetchDyMessage() {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getDyMessage.html?lang=zh_tw`)
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      let messages = [];
      for (let item of data.data) {
        let startTime = Date.parse(item.startTime.replace(' ','T') + '+08:00');
        let expireTime = Date.parse(item.expireTime.replace(' ','T') + '+08:00');
        let now = Date.now();
        if (startTime < now && expireTime > now) {
          messages.push(item.message);
        }
        this.setState({messages: messages});
      }
    })
    .catch(error => {
      console.log(error);
      this.props.handleNetworkError(true);
    })
  }

  fetchRoutes() {
    this.setState({busList: []})
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getRouteAndCompanyList.html?lang=zh_tw`)
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      this.setState({busList: data.data.routeList});
    })
    .catch(error => {
      console.log(error);
      this.props.handleNetworkError(true);
    });
  }

  returnHome = () => {
    if (!this.state.noInternet) {
      // clearAllBodyScrollLocks();
      this.route = null;
      this.color = null;
      this.setState({
        shouldModalBeShown: false
      });
    }
  }

  requestRoute(route,color) {
    this.route = route;
    this.color = color;
    this.setState({
      shouldModalBeShown: true,
    });
  }

  componentDidMount() {
    this.fetchRoutes();
    this.fetchDyMessage();
    PullToRefresh.init({
      mainElement: '#route-main-route-view > .container',
      triggerElement: '#app',
      distThreshold: 80,
      distReload: 60,
      distMax: 100,
      instructionsPullToRefresh: '向下拉以重新載入',
      instructionsReleaseToRefresh: '鬆開以重新載入',
      instructionsRefreshing: '重新載入中',
      onRefresh() {
        const event = new Event('reload-routes');
        window.dispatchEvent(event);
      },
      shouldPullToRefresh() {
        return !this.triggerElement.scrollTop && !document.querySelector('.modal.shown') && document.querySelector('.view.active#route-view');
      }
    });
    window.addEventListener('reload-routes', () => {
      this.fetchRoutes();
      this.fetchDyMessage();
    });
    const observer = new MutationObserver(() => {
      this.setState({isModalVisible: document.querySelector('.modal.shown') !== null});
    })
    observer.observe(document.documentElement,{ attributes: true, childList: true, subtree: true })
  }

  render() {
    return (
      <div className={`view${this.props.currentView === 'route' ? ' active' : ''}`} id='route-view'>
        <header className='view-header-top fixed-top row justify-content-md-center'>
          <h6 className='col-auto'>路線查詢</h6>
          <div className='route-options'>
            {this.state.messages.length > 0 && 
              <button className='route-info btn' id='toggleInfoBox' aria-label='Messages Button'>
                <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-info-circle-fill' viewBox='0 0 16 16'>
                  <path fillRule='evenodd' d='M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'/>
                </svg>
              </button>
            }
          </div>
        </header>
        <div id='route-info-box' className='route-info-box modal'>
          <div className='route-header'>
            <h5>溫馨提示</h5>
          </div>
          <div className='route-info-content'>
            <ul>
              {this.state.messages.map(message => <li key={message.slice(0,2)}>{message}</li>)}
            </ul>
          </div>
        </div>
        <div id='route-shadow' className={
          `${this.state.isModalVisible ? 'route-shadow-shown' : ''}`
        } onClick={() => this.returnHome()}></div>
        <div id='route-main-route-view' className='view-main'>
          <div className='container'>
            {
              this.state.busList.length > 0
              ?
              <div className='row'>
                {this.state.busList.map(route => <button key={route.routeName} aria-label={`Route ${route.routeName}`} className={`route-bus col-md-1 col-2 btn ${route.color.toLowerCase()}`} onClick={() => this.requestRoute(route.routeName, route.color)}>{route.routeName}</button>)}
              </div>
              :
              <div className='route-loading'>
                載入中...
              </div>
            }
          </div>
        </div>
        <RouteModal route={this.route} color={this.color} shown={this.state.shouldModalBeShown} returnHome={this.returnHome} calculateTime={this.calculateTime} handleNetworkError={this.props.handleNetworkError}></RouteModal>
      </div>
    )
  }
}

class RouteModal extends React.Component {

  intervals = [];
  fetchController = new AbortController();
  isDataReady = {
    bridgeData: false,
    busData: false,
    locationData: false,
    routeData: false,
    routeTraffic: false,
  }
  bridgeCoords = {
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
  }
  bridgeRoute = {}
  currentWarning = 0
  currentOpenedIndex = null
  isScrolling = null
  isMapLoaded = false
  eventListenersFunc = []
  busMap = null

  busLayerGroup = []
  stationLayerGroup = []
  focusingStation = false
  settingUpBusLayer = false
  settingUpStationLayer = false
  settingUpRouteLayer = false
  isMapRefreshed = false

  constructor(props) {
    super(props);
    this.state = {
      arrivingBuses: {},
      bridgeData: null,
      busColor: null,
      busRoute: null,
      busData: null,
      busDirection: 0,
      directionAvailable: '2',
      gettingArrivingBuses: false,
      isMapEnabled: false,
      locationData: null,
      routeData: null,
      routeTraffic: null,
      shown: false,
    }
  }

  busIconSrc = () => { return require(`../images/icons/${this.state.busColor?.toLowerCase()}-bus-icon.png`).default }
  lastBusIconSrc = () => { return require(`../images/icons/${this.state.busColor?.toLowerCase()}-bus-icon-last.png`).default }

  changeDirection() {
    this.fetchController.abort();
    this.fetchController = new AbortController();
    const changeDirectionIcon = document.querySelector('#route-changedirection-icon');
    if (changeDirectionIcon) changeDirectionIcon.disabled = true;
    setTimeout(() => {
      const changeDirectionIcon = document.querySelector('#route-changedirection-icon');
      if (changeDirectionIcon) changeDirectionIcon.disabled = false;
    }, 5000);
    const details = document.querySelectorAll('details');
    details.forEach(detail => {
      detail.removeAttribute('open');
    });
    this.bridgeRoute = {};
    this.isDataReady = {
      busData: false,
      bridgeData: false,
      locationData: false,
      routeData: false,
      routeTraffic: false,
    }
    this.setState({
      busDirection: (this.state.busDirection === 0) ? 1 : 0,
      routeTraffic: null,
      routeData: null,
      busData: null,
    }, () => {
      this.fetchBusData();
      this.fetchRouteData();
      this.fetchTrafficData();
    })
    if (this.busLayerGroup != []) {
      for (let marker of this.busLayerGroup) {
        marker.remove();
      }
    }
    this.busLayerGroup = []
    if (this.stationLayerGroup != []) {
      for (let marker of this.stationLayerGroup) {
        marker.remove();
      }
    }
    this.stationLayerGroup = []
    if (this.state.isMapEnabled && this.busMap && this.busMap.getLayer('route')) {
      this.busMap.removeLayer('route');
      this.busMap.removeSource('route');
    }
    this.setupStationMarkersOnMap();
    this.setupBusMarkersOnMap();
    this.setupRoutesOnMap();
    if (this.busMap && this.state.isMapEnabled && document.querySelector('.route-bus-info-container')) {
      document.querySelector('.route-bus-info-container').setAttribute('style','');
    }

  }

  disableMap() {
    this.setState({
      isMapEnabled: false,
    }, () => {
      localStorage.isRouteMapEnabled = false;
      if (this.busMap) {
        this.busMap.remove();
      }
      this.busMap = null;
      this.isMapLoaded = false;
      this.busLayerGroup = [];
      this.stationLayerGroup = [];
      document.querySelector('.route-bus-info-container').setAttribute('style','');
      let thisTop = document.querySelector('.route-navbar').offsetTop;
      let titleHeight = document.querySelector('.route-bus-title').offsetHeight;
      document.querySelector('.route-navbar').classList.toggle('stuck', thisTop > titleHeight);
    })
  }

  enableMap() {
    this.setState({
      isMapEnabled: true,
    }, () => {
      this.isMapRefreshed = false;
      this.initMap();
      this.setupBusMarkersOnMap();
      this.setupStationMarkersOnMap();
      this.setupRoutesOnMap();
      document.querySelector('.route-bus-info-container').setAttribute('style','');
      document.querySelector('.route-modal').scroll({top: 0});
      document.querySelector('.route-modal').style.setProperty('--title-offset-top',`${document.querySelector('.route-bus-title').offsetTop}px`)
      this.busMap.resize();
    })
    localStorage.isRouteMapEnabled = true;
  }

  fetchBusData() {
    this.isDataReady.busData = false;
    this.isDataReady.locationData = false;
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/bus?routeName=${this.state.busRoute}&dir=${this.state.busDirection}`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      this.isDataReady.busData = true;
      this.setState({
        busData: data.data
      })
    })
    .catch(error => {
      console.log(error);
      if (error instanceof TypeError) {
        this.isDataReady.busData = true;
        this.props.handleNetworkError(true);
      }
    });
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/location?routeName=${this.state.busRoute}&dir=${this.state.busDirection}&lang=zh-tw`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      this.isDataReady.locationData = true;
      this.setState({
        locationData: data.data,
      })
    })
    .catch(error => {
      console.log(error);
      if (error instanceof TypeError) {
        this.isDataReady.locationData = true;
        this.props.handleNetworkError(true);
      }
    });
  }

  fetchRouteData() {
    this.isDataReady.routeData = false;
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html?routeName=${this.state.busRoute}&dir=${this.state.busDirection}&lang=zh-tw`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      for (let i = 0; i < data.data.routeInfo.length-2; i++) {
        if (data.data.routeInfo.slice()[i].staCode[0] != data.data.routeInfo.slice()[i+1].staCode[0] && data.data.routeInfo.slice()[i].staCode[0] != 'C' && data.data.routeInfo.slice()[i+1].staCode[0] != 'C') {
          this.bridgeRoute[i] = [data.data.routeInfo.slice()[i].staCode[0],data.data.routeInfo.slice()[i+1].staCode[0]];
        }
      }
      this.isDataReady.routeData = true;
      this.setState({
        routeData: data.data,
        directionAvailable: data.data.direction,
        isRouteChanged: (data.data.routeInfo.filter(sta => sta.suspendState === '1').length != 0)
      })
      this.waitUntil(() => {
        const details = document.querySelectorAll('details');
        details.forEach((targetDetail) => {
          targetDetail.addEventListener('click', () => {
            details.forEach((detail) => {
              if (detail !== targetDetail) {
                detail.removeAttribute('open');
              }
            });
          });
        });
      })
    })
    .catch(error => {
      console.log(error);
      if (error instanceof TypeError) {
        this.isDataReady.routeData = true;
        this.props.handleNetworkError(true);
      }
    });
  }

  fetchTrafficData() {
    this.isDataReady.trafficData = false;
    this.isDataReady.bridgeData = false;
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37011/its/Bridge/getTime.html?lang=zh_tw`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      this.isDataReady.bridgeData = true;
      this.setState({bridgeData: data.data.timeArray})
    })
    .catch(error => {
      console.log(error);
      if (error instanceof TypeError) {
        this.isDataReady.bridgeData = true;
        this.props.handleNetworkError(true);
      }
    });
    
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/ddbus/common/supermap/route/traffic?routeCode=${'0'.repeat(5-this.state.busRoute.length) + this.state.busRoute}&direction=${this.state.busDirection}&indexType=00&device=web`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      let tempData = data.data;
      this.waitUntil(() => {
        let jamRouteIndex = this.state.busData.routeInfo.findIndex((sta) => sta.staCode.includes('M84'));
        if (jamRouteIndex > -1) {
          jamRouteIndex -= 1;
          tempData[jamRouteIndex].routeTraffic = parseInt(tempData[jamRouteIndex].routeTraffic)+2;
        }
        if (this.busRoute === '32') {
          let cloneRouteIndex = this.state.busData.routeInfo.findIndex((sta) => sta.staCode.includes('M254/1'));
          if (cloneRouteIndex > -1) {
            cloneRouteIndex -= 1;
            tempData[cloneRouteIndex].routeTraffic = parseInt(tempData[cloneRouteIndex].routeTraffic) / 5
          }
        }
        for (let bridgeRoute in this.bridgeRoute) {
          let direction = null;
          if (this.bridgeRoute[bridgeRoute][0] === 'T') {
            direction = 0;
          } else {
            direction = 1;
          }
          let onbridge;
          for (let point of tempData.slice()[parseInt(bridgeRoute)].routeCoordinates.split(';')) {
            if (point != '') {
              let loc = point.split(',')
              for (let id in this.bridgeCoords) {
                let poly = helpers.polygon(this.bridgeCoords[id][0]);
                let pt = helpers.point([parseFloat(loc[0]),parseFloat(loc[1])]);
                if (booleanPointInPolygon(pt,poly)) {
                  onbridge = id;
                  break;
                }
              }
              if (onbridge) {
                break;
              }
            }
          }
          let timeToCrossBridgeInSec = parseInt(this.state.bridgeData.slice()[direction].times.filter(bridge => bridge.id === onbridge)[0].time);
          if (timeToCrossBridgeInSec > -1) {
            let speed = (this.bridgeCoords[onbridge].slice()[1] / timeToCrossBridgeInSec * 3.6) > 52 ? 52 : this.bridgeCoords[onbridge].slice()[1] / timeToCrossBridgeInSec * 3.6;
            let traffic = 1 / (speed / 3.6 * 60 / 750);
            tempData[parseInt(bridgeRoute)].routeTraffic = traffic.toString();
          }
        }
        this.isDataReady.routeTraffic = true;
        this.setState({routeTraffic: tempData})
      },false)
    })
    .catch(error => {
      console.log(error);
      if (error instanceof TypeError) {
        this.isDataReady.routeTraffic = true;
        this.props.handleNetworkError(true);
      }
    });
  }
  
  focusStation(index=this.currentOpenedIndex, from="n/a") {
    setTimeout(() => {
      if (this.state.isMapEnabled && this.busMap && this.focusingStation) {
        let stationLoc = [this.state.locationData.stationInfoList.slice()[index].longitude,this.state.locationData.stationInfoList.slice()[index].latitude];
        if (this.state.arrivingBuses[index] && this.state.arrivingBuses[index][0] && this.state.arrivingBuses[index][0].currentStation >= 0) {
          // console.log(from, 'focusing station')
          let closestBusLoc = this.state.arrivingBuses[index][0].location;
          let closestStationIndex = this.state.arrivingBuses[index][0].currentStation - 1;
          let routeCoords = [closestBusLoc];
          for (let p of this.state.routeTraffic.slice(closestStationIndex, index)) {
            for (let line of p.routeCoordinates.split(';')) {
              if (line.includes(',')) {
                routeCoords.push([parseFloat(line.split(',')[0]),parseFloat(line.split(',')[1])]);
              }
            }
          }
          routeCoords.push(stationLoc);
          let abbox = bbox(helpers.lineString(routeCoords));
          this.busMap.fitBounds(abbox, {padding: 25, maxZoom: 15.5});
          let routeSource = this.busMap.getSource('route');
          if (routeSource) {
            routeSource = this.busMap.getSource('route')._data;
            for (let [i,features] of routeSource.features.slice().entries()) {
              if (i >= index || i < closestStationIndex) {
                features.properties.opacity = 0.25;
              } else {
                features.properties.opacity = 1;
              }
            }
            this.busMap.getSource('route').setData(routeSource)
          }
          for (let i = 0; i < this.stationLayerGroup.length; i++) {
            if (i > index || i < closestStationIndex) {
              this.stationLayerGroup.slice().reverse()[i].getElement().style.opacity = 0;
            } else if (i === index || i === closestStationIndex) {
              this.stationLayerGroup.slice().reverse()[i].getElement().style.opacity = 1;
            }
            else {
              this.stationLayerGroup.slice().reverse()[i].getElement().style.removeProperty('opacity');
            }
          }
          let busPlateWithSameDistance = [];
          for (let arrivingBus of  this.state.arrivingBuses[index].slice()){
            if (arrivingBus.stopsRemaining === this.state.arrivingBuses[index][0].stopsRemaining) {
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
          this.busMap.flyTo({
            center: stationLoc,
            zoom: 15.5,
          });
          let routeSource = this.busMap.getSource('route');
          if (routeSource) {
            routeSource = this.busMap.getSource('route')._data;
            for (let features of routeSource.features.slice()) {
              features.properties.opacity = 1;
            }
            this.busMap.getSource('route').setData(routeSource);
          }
          for (let i = 0; i < this.stationLayerGroup.length; i++) {
            this.stationLayerGroup.slice().reverse()[i].getElement().style.removeProperty('opacity');
          }
          for (let busElement of document.querySelectorAll('.route-bus-marker')) {
            busElement.style.removeProperty('visibility');
          }
        }
      }
    },150)
  }

  getArrivingBuses(index = this.currentOpenedIndex) {
    if (index != null) {
      this.setState({gettingArrivingBuses: true});
      this.waitUntil(() => {
        let busInfoLocations = this.state.locationData.busInfoList;
        if (busInfoLocations && this.state.routeTraffic) {
          let stationBefore = this.state.busData.routeInfo.slice(0, index).reverse();
          let count = 0;
          let tempArr = [];
          for (let i = 0; i < index; i++) {
            for (let comingBus of stationBefore[i].busInfo) {
              if (count < 3) {
                let routeTraffic = this.state.routeTraffic[index-i-1].routeTraffic;
                tempArr.push({
                  'plate': `${comingBus.busPlate.substring(0,2)}-${comingBus.busPlate.substring(2,4)}-${comingBus.busPlate.substring(4,6)}`,
                  // 'plate': comingBus.busPlate,
                  'speed': comingBus.speed,
                  'stopsRemaining': i + 1,
                  'durationGet': true,
                  'duration': this.props.calculateTime(this.state.routeTraffic,index-i,index,[busInfoLocations.filter(bus => bus.busPlate === comingBus.busPlate)[0].longitude,busInfoLocations.filter(bus => bus.busPlate === comingBus.busPlate)[0].latitude],comingBus),
                  'routeTraffic': routeTraffic,
                  'location': [busInfoLocations.filter(bus => bus.busPlate === comingBus.busPlate)[0].longitude,busInfoLocations.filter(bus => bus.busPlate === comingBus.busPlate)[0].latitude],
                  'currentStation': index - i,
                });
                count++;
              }
            }
          }
          tempArr.sort((x,y) => (x.duration > y.duration) ? 1 : ((x.duration < y.duration) ? -1 : 0));
          this.setState(prevState => ({
            arrivingBuses: {
              ...prevState.arrivingBuses,
              [index]: tempArr,
            }
          }))
          this.focusStation(this.currentOpenedIndex, 'getArrivingBuses');
        }
        this.setState({gettingArrivingBuses: false});
      },true)
    }
  }

  initMap() {
    let mapStyle = 'matthewngan/ckjzsnvju0uqx17o6891qzch5';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mapStyle = 'matthewngan/ckjzsftuo0uik17o62fm4oahc';
    }
    this.busMap = new mapboxgl.Map({
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
    this.busMap.touchZoomRotate.disableRotation();
    this.busMap.on('zoomend', () => {
      if (this.busMap.getZoom() > 13.5) {
        for (let mapStation of document.querySelectorAll('.route-map-station')) {
          mapStation.classList.toggle('shown',true)
        }
      } else {
        for (let mapStation of document.querySelectorAll('.route-map-station')) {
          mapStation.classList.toggle('shown',false)
        }
      }
      if (this.busMap.getZoom() > 14) {
        for (let mapImportantStationText of document.querySelectorAll('.destination span, .origin span')) {
          mapImportantStationText.classList.toggle('shown',true);
        }
        for (let busMarker of document.querySelectorAll('.route-bus-marker')) {
          busMarker.style.width = (this.busMap.getZoom() + 3).toString() + 'px';
          busMarker.style.height = (this.busMap.getZoom() + 3).toString() + 'px';
        }
        if (this.busMap.getLayer('route')) this.busMap.setPaintProperty('route','line-width',4)
      } else {
        for (let mapImportantStationText of document.querySelectorAll('.destination span, .origin span')) {
          mapImportantStationText.classList.toggle('shown',false);
        }
        for (let busMarker of document.querySelectorAll('.route-bus-marker')) {
          busMarker.style.width = '14px';
          busMarker.style.height = '14px';
        }
        if (this.busMap.getLayer('route')) this.busMap.setPaintProperty('route','line-width',2)
      }
    })
    this.busMap.on('load', () => this.isMapLoaded = true);
  }

  removeInterval() {
    for (let interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }

  resetData() {
    this.removeInterval();
    this.fetchController.abort();
    this.fetchController = new AbortController();
    this.bridgeRoute = {};
    this.currentWarning = 0;
    this.currentOpenedIndex = null;
    this.focusingStation = false;
    this.isDataReady = {
      bridgeData: false,
      busData: false,
      locationData: false,
      routeData: false,
      routeTraffic: false,
    }
    this.setState({
      arrivingBuses: {},
      busColor: null,
      busRoute: null,
      busData: null,
      busDirection: 0,
      directionAvailable: '2',
      locationData: null,
      routeData: null,
      routeTraffic: null,
      shown: false,
    })
    if (this.state.isMapEnabled && this.busMap != null) this.resetMap();
    for (let func of this.eventListenersFunc) {
      document.querySelector(func[1]).removeEventListener(func[0], func[2])
    }
  }

  resetMap() {
    this.busMap.setCenter([113.5622406,22.166422]);
    this.busMap.setZoom(11);
    document.querySelector('#route-bus-map').setAttribute('style','');
    document.querySelector('.mapboxgl-canvas').setAttribute('style','');
    this.busMap.resize();
    if (this.stationLayerGroup != []) {
      for (let marker of this.stationLayerGroup) {
        marker.remove();
      }
    }
    this.stationLayerGroup = [];
    if (this.busLayerGroup != []) {
      for (let marker of this.busLayerGroup) {
        marker.remove();
      }
    }
    this.busLayerGroup = [];
    if (this.busMap.getLayer('route')) {
      this.busMap.removeLayer('route');
      this.busMap.removeSource('route');
    }
    this.isMapRefreshed = false;
  }

  requestRoute() {
    if (this.state.isMapEnabled && !this.busMap) {
      this.initMap();
    }
    disableBodyScroll(document.querySelector('#route-modal'));
    let scrollEventFunc = () => {
      if (!this.busMap && !this.state.isMapEnabled && document.querySelector('.route-bus-title')) {
        let thisTop = document.querySelector('.route-navbar').offsetTop;
        let titleHeight;
        if (this.state.isMapEnabled) titleHeight = document.querySelector('.route-bus-title').offsetHeight + document.querySelector('#route-bus-map').offsetHeight;
        else titleHeight = document.querySelector('.route-bus-title').offsetHeight
        document.querySelector('.route-navbar').classList.toggle('stuck', thisTop > titleHeight);
      } else {
        document.querySelector('.route-navbar')?.classList.toggle('stuck', false);
      }
      if (this.busMap && this.state.isMapEnabled && document.querySelector('.route-bus-title')) {
        document.querySelector('.route-modal').style.setProperty('--title-offset-top',`${document.querySelector('.route-bus-title').offsetTop}px`)
        this.busMap.resize();
      }
      if (this.isScrolling) clearTimeout(this.isScrolling);
      this.isScrolling = setTimeout(() => {
        if (this.busMap && this.state.isMapEnabled) {
          this.focusStation(this.currentOpenedIndex, 'scroll');
        }
      }, 66);
    }
    this.eventListenersFunc.push(['scroll','#route-modal',scrollEventFunc])
    document.querySelector('#route-modal').addEventListener('scroll',scrollEventFunc);
    document.querySelector('#route-modal').scrollTop = 0;

    this.fetchRouteData();
    this.fetchBusData();
    this.fetchTrafficData();
    this.setupBusMarkersOnMap();
    this.setupRoutesOnMap();
    this.setupStationMarkersOnMap();
    let dataInterval = setInterval(() => {
      this.fetchBusData();
      this.setupBusMarkersOnMap();
    }, 10000);
    let trafficInterval = setInterval(() => {
      this.fetchTrafficData();
      this.setupRoutesOnMap();
    },30000);
    this.intervals = [dataInterval, trafficInterval];
  }

  scrollToWarning() {
    let container = (this.busMap && this.state.isMapEnabled) ? document.querySelector('.route-bus-info-container') : document.querySelector('.route-modal');
    let suspendedParent = document.querySelectorAll('.route-suspended')[this.currentWarning].parentNode;
    container.scroll({top: (this.busMap && this.state.isMapEnabled) ? suspendedParent.offsetTop - document.querySelector('.route-navbar').offsetHeight : suspendedParent.offsetTop + document.querySelector('.route-bus-title').offsetHeight, behavior: 'smooth'});
    let suspendedStations = this.state.routeData.routeInfo.filter(station => station.suspendState === '1');
    if (this.currentWarning === suspendedStations.length-1) this.currentWarning = 0;
    else if (suspendedStations.length !== 0) this.currentWarning ++;
  }
  
  setupBusMarkersOnMap() {
    if (this.state.isMapEnabled && !this.settingUpBusLayer) {
      this.settingUpBusLayer = true;
      this.waitUntil(() => {
        if (this.state.locationData) {
          if (this.busLayerGroup != []) {
            for (let marker of this.busLayerGroup) {
              marker.remove();
            }
          }
          this.busLayerGroup = [];
          for (let bus of this.state.locationData.busInfoList.slice().filter(bus => bus.speed > -1)) {
            let busElement = document.createElement('img');
            if (bus.busPlate === this.state.busData?.lastBusPlate) busElement.src = this.lastBusIconSrc();
            else busElement.src = this.busIconSrc();
            busElement.classList.add('route-bus-marker');
            busElement.id = `bus-${bus.busPlate.substring(0,2)}-${bus.busPlate.substring(2,4)}-${bus.busPlate.substring(4,6)}`;
            for (let sta of this.state.busData.routeInfo) {
              for (let lbus of sta.busInfo) {
                if (lbus.busPlate === bus.busPlate && lbus.status === '0') {
                  busElement.classList.add('moving',true);
                  break;
                };
              }
              if (busElement.classList.contains('moving')) break;
            }
            if (this.busMap.getZoom() <= 14) {
              busElement.style.width = '14px';
              busElement.style.height = '14px';
            }
            else {
              busElement.style.width = (this.busMap.getZoom() + 1.5).toString() + 'px';
              busElement.style.height = (this.busMap.getZoom() + 1.5).toString() + 'px';
            }
            if (this.focusingStation && !busElement.id.includes(this.state.arrivingBuses[this.currentOpenedIndex]?.[0]?.plate)) {
              busElement.style.setProperty('visibility', 'hidden');
            } else {
              busElement.style.removeProperty('visibility');
            }
            let busPopup = new mapboxgl.Popup({closeButton: false, offset: 12}).setHTML(`<code class='${this.state.busColor.toLowerCase()}'>` + bus.busPlate + '</code>' + (bus.speed === '-1' ? '' : ` ${bus.speed}km/h`));
            let busMarker = new mapboxgl.Marker(busElement).setLngLat([bus.longitude, bus.latitude]).setPopup(busPopup).addTo(this.busMap);
            this.busLayerGroup.push(busMarker);
          }
        }
        this.getArrivingBuses(this.currentOpenedIndex);
        this.settingUpBusLayer = false;
      })
    }
  }
  
  setupRoutesOnMap() {
    if (this.state.isMapEnabled && this.busMap) {
      this.waitUntil(() => {
        if (this.state.routeTraffic != null) {
          let allCoords = [];
          let source = {
            'type': 'geojson',
            'data': {
              'type': 'FeatureCollection',
              'features': []
            },
          }
          for (let i = 0; i < this.state.routeTraffic.length-1; i++) {
            if (typeof(this.state.routeTraffic[i].routeCoordinates) === 'string') {
              let routeCoordinates = [];
              for (let routeCoordinate of this.state.routeTraffic[i].routeCoordinates.slice().split(';')) {
                routeCoordinates.push([parseFloat(routeCoordinate.split(',')[0]),parseFloat(routeCoordinate.split(',')[1])]);
                allCoords.push([parseFloat(routeCoordinate.split(',')[0]),parseFloat(routeCoordinate.split(',')[1])]);
              }
              let color;
              if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 1) color = '#007400';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 2) color = '#5b7c00';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 3) color = '#817f00';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 4) color = '#7e4e00';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) >= 5) color = '#7e0f00';
                else color = '#777777'
              } else {
                if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 1) color = '#3acc00';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 2) color = '#99c800';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 3) color = '#d1bc00';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) === 4) color = '#d68400';
                else if (Math.ceil(parseFloat(this.state.routeTraffic[i].routeTraffic)) >= 5) color = '#c70000';
                else color = '#999999'
              }
              routeCoordinates.pop();
              let opacity = 1;
              let index = this.currentOpenedIndex;
              if (index != null && this.focusingStation && this.state.arrivingBuses?.[index]?.[0]) {
                let closestStationIndex = this.state.arrivingBuses[index][0].currentStation - 1;
                if (i >= index || i < closestStationIndex) {
                  opacity = 0.25;
                }
              }
              source.data.features.push({
                'type': 'Feature',
                'properties': {
                  'color': color,
                  'opacity': opacity,
                },
                'geometry': {
                  'type': 'LineString',
                  'coordinates': routeCoordinates,
                },
              })
            }
          }
          if (this.busMap.getLayer('route') && this.busMap.getSource('route')) {
            this.busMap.getSource('route').setData(source.data);
          } else {
            this.busMap.addSource('route',source)
            this.busMap.addLayer({
              'id': 'route',
              'type': 'line',
              'source': 'route',
              'layout': {
                'line-join': 'round',
                'line-cap': 'round',
              },
              'paint': {
                'line-color': ['get','color'],
                'line-width': this.busMap.getZoom() > 14 ? 4 : 2,
                'line-opacity': ['get','opacity'],
              }
            });
          }
          if (!this.isMapRefreshed) {
            let routeLine = helpers.lineString(allCoords);
            let abbox = bbox(routeLine);
            this.busMap.fitBounds(abbox, {padding: 50});
            this.isMapRefreshed = true;
          }
        }
      })
    }
  }
  
  setupStationMarkersOnMap() {
    if (this.state.isMapEnabled && this.busMap) {
      this.waitUntil(() => {
        if (this.state.locationData) {
          if (this.stationLayerGroup != []) {
            for (let marker of this.stationLayerGroup) {
              marker.remove();
            }
          }
          this.stationLayerGroup = [];
          for (let [index,station] of this.state.locationData.stationInfoList.slice().reverse().entries()) {
            let stationElement,stationTextElement;
            if (index === this.state.locationData.stationInfoList.length - 1) {
              stationElement = document.createElement('div');
              stationTextElement = document.createElement('span');
              stationTextElement.innerHTML = this.state.routeData.routeInfo.slice().reverse()[index].staName;
              stationElement.classList.add('route-map-important-station');
              stationElement.classList.add('origin');
              stationElement.appendChild(stationTextElement);
            } else if (index === 0) {
              stationElement = document.createElement('div');
              stationTextElement = document.createElement('span');
              stationTextElement.innerHTML = this.state.routeData.routeInfo.slice().reverse()[index].staName;
              stationElement.classList.add('route-map-important-station');
              stationElement.classList.add('destination');
              stationElement.appendChild(stationTextElement);
            } else if (AppData.mainStations.includes(this.state.routeData.routeInfo.slice().reverse()[index].staCode.split('/')[0])) {
              stationElement = document.createElement('div');
              stationElement.classList.add('route-map-important-station');
            } else {
              stationElement = document.createElement('img');
              if (this.colorScheme === 'light') stationElement.src = require('../images/icons/bus-stop-light.png').default;
              else stationElement.src = require('../images/icons/bus-stop-dark.png').default;
              stationElement.classList.add('route-map-station');
              if (this.busMap.getZoom() <= 13.5) stationElement.classList.toggle('shown',false);
              else stationElement.classList.toggle('shown',true);
            }
            stationElement.addEventListener('hover',() => {
              this.busMap.getCanvas().style.cursor = 'pointer';
            });
            stationElement.addEventListener('click',(e) => {
              const details = document.querySelectorAll('details')
              details.forEach((detail) => {
                if (detail != e) detail.removeAttribute('open');
              });
              this.currentPopup = this.state.locationData.stationInfoList.slice().length - index - 1;
              document.querySelectorAll('.route-bus-info details')[this.state.locationData.stationInfoList.slice().length - index - 1].open = true;
              document.querySelector('.route-bus-info-container').scroll({top: (1.5 * parseFloat(getComputedStyle(document.documentElement).fontSize) + 20)*(this.state.locationData.stationInfoList.slice().length - index - 1), behavior: 'smooth'});
            });
            let stationPopup = new mapboxgl.Popup({closeButton: false, offset: 8}).setText(`${this.state.routeData.routeInfo.slice().reverse()[index].staCode} ${this.state.routeData.routeInfo.slice().reverse()[index].staName}`);
            stationPopup.on('close', () => {
              this.unfocusStation();
            })
            let stationMarker = new mapboxgl.Marker(stationElement).setLngLat([parseFloat(station.longitude), parseFloat(station.latitude)]).setPopup(stationPopup).addTo(this.busMap);
            this.stationLayerGroup.push(stationMarker);
          }
        }
      })
    }
  }

  toggleIndex = (index) => {
    this.currentOpenedIndex = index;
    this.getArrivingBuses(this.currentOpenedIndex);
    let details = document.querySelectorAll('details');
    if (this.currentPopup != null && this.stationLayerGroup) this.stationLayerGroup.slice().reverse()[this.currentPopup].getPopup().remove();
    if (details?.[index]?.hasAttribute('open')) {
      this.focusingStation = true;
      if (this.state.isMapEnabled && this.busMap && this.stationLayerGroup) {
        this.stationLayerGroup.slice().reverse()[index].getPopup().addTo(this.busMap);
        this.currentPopup = index;
      }
    }
  }

  unfocusStation() {
    this.currentPopup = null;
    this.focusingStation = false;
    setTimeout(() => {
      if (this.state.isMapEnabled && this.busMap && !this.focusingStation) {
        for (let i = 0; i < this.stationLayerGroup.length; i++) {
          this.stationLayerGroup[i].getElement().style.removeProperty('opacity');
        }
        var routeSource = this.busMap.getSource('route');
        if (routeSource) {
          routeSource = this.busMap.getSource('route')._data;
          for (let features of routeSource.features.slice()) {
            features.properties.opacity = 1;
          }
          this.busMap.getSource('route').setData(routeSource);
        }
        for (let busElement of document.querySelectorAll('.route-bus-marker')) {
          busElement.style.removeProperty('visibility');
        }
      }
    }, 50)
  }

  waitUntil(callback,a=true) {
    setTimeout(() => {
      let condition = [this.isDataReady.routeData, this.isDataReady.locationData, this.isDataReady.busData, this.isDataReady.bridgeData]
      if (a) condition.push(this.isDataReady.routeTraffic);
      if (this.state.isMapEnabled) condition.push(this.isMapLoaded);
      let b = true;
      for (let item of condition) {
        if (!item) {
          b = false;
          break;
        }
      }
      if (b) {
        callback();
      } else {
        this.waitUntil(callback,a);
      }
    },50);
  }

  componentDidMount() {
    if (localStorage.isRouteMapEnabled) {
      this.setState({isMapEnabled: localStorage.isRouteMapEnabled === 'true'});
    } else {
      localStorage.isRouteMapEnabled = 'false';
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',
      () => {
        if (this.state.isMapEnabled) {
          if (this.state.shown) {
            this.disableMap();
            this.enableMap();
          } else {
            if (this.busMap) this.busMap.remove();
            this.busMap = null;
          }
        }
      }
    );
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.shown != this.props.shown) {
      this.setState({
        shown: this.props.shown,
        busRoute: this.props.route,
        busColor: this.props.color,
      }, () => {
        if (this.props.shown) {
          this.fetchController = new AbortController();
          this.requestRoute();
        } else {
          this.resetData();
        }
      });
    }
  }

  componentWillUnmount() {
    this.resetData();
    this.removeInterval();
  }

  render() {
    return (
      <div className={`modal route-modal ${this.state.shown ? 'shown' : ''}`} id='route-modal'>
        {
          this.state.shown &&
          <RouteModalHeader color={this.state.busColor} route={this.state.busRoute} direction={this.state.busDirection} routeData={this.state.routeData} directionAvailable={this.state.directionAvailable}></RouteModalHeader>
        }   
        {this.state.isMapEnabled ? <div id='route-bus-map'></div> : null}
        <div className='route-main-info-container'>
          <div className='route-navbar'>
            <button onClick={() => this.props.returnHome()} className='col-auto btn' aria-label='Return Button'>
              <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-arrow-left' viewBox='0 0 16 16'>
                <path fillRule='evenodd' d='M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z'/>
              </svg>
            </button>
            {
              (this.state.routeData && !this.state.isMapEnabled && this.state.shown) ?
              <div className='col row route-navbar-title'>
                <div className={`col-auto route-navbar-bus ${this.state.busColor?.toLowerCase()}`}>
                  <span>{this.state?.busRoute}</span>
                </div>
                <div className='route-header h5 col'>
                  <span className='route-destination'>
                    {AppData.routeMainPoints[this.state.busRoute?.toUpperCase()] ? AppData.routeMainPoints[this.state.busRoute.toUpperCase()][this.state.busDirection] : this.state.routeData.routeInfo[0].staName}&nbsp;
                  </span>
                  <span className='route-destination'>
                    {
                      this.state.directionAvailable === '2' ?
                      <svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='currentColor' className='bi bi-arrow-repeat' viewBox='0 0 16 16'>
                        <path d='M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z'/>
                        <path fillRule='evenodd' d='M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z'/>
                      </svg>
                      : <svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='currentColor' className='bi bi-arrow-right' viewBox='0 0 16 16'>
                        <path fillRule='evenodd' d='M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z'/>
                      </svg>
                    }
                    &nbsp;{AppData.routeMainPoints[this.state.busRoute.toUpperCase()] ? AppData.routeMainPoints[this.state.busRoute.toUpperCase()].slice().reverse()[this.state.busDirection] : this.state.routeData.routeInfo.slice().reverse()[0].staName}
                  </span>
                </div>
              </div>
              : null
            }
            <div className='route-option-buttons'>
              {
                this.state.directionAvailable === '0' &&
                <button onClick={() => this.changeDirection()} type='button' className='col-auto btn' id='route-changedirection-icon' aria-label='Change Direction Button'>
                  <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-arrow-down-up' viewBox='0 0 16 16'>
                    <path fillRule='evenodd' d='M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5zm-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5z'/>
                  </svg>
                </button>
              }
              {
                this.state.isRouteChanged && 
                <button className='btn' onClick={() => this.scrollToWarning()} aria-label='Scroll to warning button'>
                  <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-exclamation-triangle-fill' viewBox='0 0 16 16'>
                    <path fillRule='evenodd' d='M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 5zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'/>
                  </svg>
                </button>
              }
              {
                this.state.isMapEnabled ?
                <button className='btn' onClick={() => this.disableMap()} aria-label='Disable Map button'>
                  <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-map-fill' viewBox='0 0 16 16'>
                    <path fillRule='evenodd' d='M16 .5a.5.5 0 0 0-.598-.49L10.5.99 5.598.01a.5.5 0 0 0-.196 0l-5 1A.5.5 0 0 0 0 1.5v14a.5.5 0 0 0 .598.49l4.902-.98 4.902.98a.502.502 0 0 0 .196 0l5-1A.5.5 0 0 0 16 14.5V.5zM5 14.09V1.11l.5-.1.5.1v12.98l-.402-.08a.498.498 0 0 0-.196 0L5 14.09zm5 .8V1.91l.402.08a.5.5 0 0 0 .196 0L11 1.91v12.98l-.5.1-.5-.1z'/>
                  </svg>
                </button>
                : <button className='btn' onClick={() => this.enableMap()} aria-label='Enable Map button'>
                    <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-map' viewBox='0 0 16 16'>
                      <path fillRule='evenodd' d='M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.502.502 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103zM10 1.91l-4-.8v12.98l4 .8V1.91zm1 12.98l4-.8V1.11l-4 .8v12.98zm-6-.8V1.11l-4 .8v12.98l4-.8z'/>
                    </svg>
                  </button>
              }
            </div>
          </div>
          <div className='row'>
            {
              (this.state.shown && this.state.routeData) ?
              <div className='col route-bus-info-container'>
                <RouteStationBlock
                  busIconSrc={this.busIconSrc}
                  lastBusIconSrc={this.lastBusIconSrc}
                  busData={this.state.busData}
                  color={this.state.busColor}
                  routeData={this.state.routeData.routeInfo}
                  routeTraffic={this.state.routeTraffic}
                  toggleIndex={this.toggleIndex}
                  arrivingBuses={this.state.arrivingBuses}
                  gettingArrivingBuses={this.state.gettingArrivingBuses}
                ></RouteStationBlock>
              </div>
              : <div className='route-loading route-bus-info-container'>載入中...</div>
            }
          </div>
        </div>
      </div>
    )
  }
}

class RouteModalHeader extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const route = this.props.route;
    const routeData = this.props.routeData;
    const direction = this.props.direction;
    const directionAvailable = this.props.directionAvailable;
    const color = this.props.color;
    return (
      <div className='row ml-0 route-bus-title'>
        <div className={`route-bus col-auto ${color.toLowerCase()}`}>
          <div className={route.length > 2 ? 'h6' : 'h5'}>
            <span>{route}</span>
          </div>
        </div>
        {
          routeData != null ?
          <div className='h5 route-header col'>
            <span className='route-destination'>{AppData.routeMainPoints?.[route.toUpperCase()]?.[direction] || routeData?.routeInfo?.[0].staName || ''}&nbsp;</span>
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
              &nbsp;{AppData.routeMainPoints?.[route.toUpperCase()]?.slice().reverse()[direction] || routeData?.routeInfo?.slice().reverse()[0].staName}
            </span>
          </div>
          : <div className='h5 route-header col'>
            <span className='route-destination'>
              載入中...
            </span>
          </div>
        }
        {
          route.toLowerCase() === 'ap1x' ?
          <span className='col-auto text-muted'>機場<br/>快線</span>
          : (route.toLowerCase().includes('ap') ?
            <span className='col-auto text-muted'>機場<br/>專線</span>
            : (route.toLowerCase().includes('s') ? 
              <span className='col-auto text-muted'>特班車</span>
              : (route.toLowerCase().includes('h') ? 
                <span className='col-auto text-muted'>醫院<br/>專線</span>
                : (route.toLowerCase().includes('mt') ?
                  <span className='col-auto text-muted'>澳氹<br/>專線</span>
                  : (route.toLowerCase().includes('n') ?
                    <span className='col-auto text-muted'>夜間<br/>巴士</span>
                    : (route.toLowerCase().includes('x') ?
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
    )
  }
}

class RouteStationBlock extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const arrivingBuses = this.props.arrivingBuses;
    const busIconSrc = this.props.busIconSrc();
    const lastBusIconSrc = this.props.lastBusIconSrc();
    const busData = this.props.busData;
    const color = this.props.color;
    const routeData = this.props.routeData;
    const routeTraffic = this.props.routeTraffic;
    const toggleIndex = this.props.toggleIndex;
    return (
      <div className='route-bus-info'>
        {
          routeData.map((station,index) => {
            return (
              <details key={index} onToggle={() => toggleIndex(index)}>
                {
                  <summary className={`route-traffic${index === routeData.length - 1 ? ' last' : ''}${(parseFloat(routeTraffic?.[index]?.routeTraffic) <= 1 && parseFloat(routeTraffic?.[index]?.routeTraffic) > 0) ? ' green': ''}${Math.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) === 2 ? ' yellow' : ''}${Math.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) === 3 ? ' orange' : ''}${Math.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) === 4 ? ' red' : ''}${Math.ceil(parseFloat(routeTraffic?.[index]?.routeTraffic)) >= 5 ? ' brown' : ''}`}>
                    <span className={
                      `route-station-dot${busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length > 0 ? ' hidden' : ''}`
                      }></span>
                    <span className='route-station-line'></span>
                    <span className='route-station-name'>{station.staCode} {station.staName} {station.laneName ? <code className={`lane ${station.staCode.split('/')[0]} ${station.laneName[0]}`}>{station.laneName}</code> : ''}</span>
                    {
                      busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '0').length > 0 &&
                      <span className={`route-station-bus-icon moving ${color.toLowerCase()}`}>
                          {
                            busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '0').length > 1 ?
                            <span>{busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '0').length}</span>
                            : (busData?.lastBusPlate === busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '0')[0].busPlate ? <img src={lastBusIconSrc} /> : <img src={busIconSrc} />)
                          }
                      </span>
                    }
                    {
                      busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length > 0 && 
                      <span className={`route-station-bus-icon ${color.toLowerCase()}`}>
                        {
                          busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length > 1 ?
                          <span>{busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length}</span>
                          : (busData?.lastBusPlate === busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '1')[0].busPlate ? <img src={lastBusIconSrc} /> : <img src={busIconSrc} />)
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
                    arrivingBuses?.[index]?.slice().reverse().map(arrivingBus => {
                      return (
                        <li key={arrivingBus.plate}>
                          <span><code className={color.toLowerCase()}>{arrivingBus.plate}</code> 距離 {arrivingBus.stopsRemaining} 站</span> 
                          <span className={
                            `route-time-remaining route-live${parseFloat(arrivingBus.routeTraffic) <= 1 && parseFloat(arrivingBus.routeTraffic) > 0 ? ' green' : ''}${Math.ceil(parseFloat(arrivingBus.routeTraffic)) === 2 ? ' yellow' : ''}${Math.ceil(parseFloat(arrivingBus.routeTraffic)) === 3 ? ' orange' : ''}${Math.ceil(parseFloat(arrivingBus.routeTraffic)) === 4 ? ' red' : ''}${Math.ceil(parseFloat(arrivingBus.routeTraffic)) >= 5 ? ' brown' : ''}
                            `
                            }>
                            <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-broadcast' viewBox='0 0 16 16'>
                              <path fillRule='evenodd' d='M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707zm2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 0 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708zm5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708zm2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707z'/>
                              <path d='M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'/>
                            </svg>
                            {
                              arrivingBus.duration > 30 ?
                              <span> {arrivingBus.duration <= 3600 ? (Math.round((arrivingBus.duration) / 60)) + ' 分鐘' : '多於 ' + Math.floor((arrivingBus.duration) / 3600) + ' 小時'}</span>
                              : <span> 即將進站</span>
                            }
                          </span>
                        </li>
                      )
                    })
                  }
                  {
                    busData?.routeInfo?.[index]?.busInfo.filter(bus => bus.status === '1').map(bus => {
                      return (
                        <li key={bus.busPlate}>
                          <span><code className={color.toLowerCase()}>{bus.busPlate.substring(0,2)}-{bus.busPlate.substring(2,4)}-{bus.busPlate.substring(4,6)}</code></span>
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
                    busData?.routeInfo?.[index]?.busInfo.filter(bus => bus.status === '0').map(bus => {
                      return (
                        <li key={bus.busPlate} className='route-left'>
                          {bus.busPlate === busData?.lastBusPlate ? <img src={lastBusIconSrc} /> : <img src={busIconSrc} />}
                          <span><code className={color.toLowerCase()}>{bus.busPlate.substring(0,2)}-{bus.busPlate.substring(2,4)}-{bus.busPlate.substring(4,6)}</code></span>
                          <span className='route-time-remaining'>前往下一站中</span>
                        </li>
                      )
                    })
                  }
                  {
                    (busData?.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length == 0 && (!arrivingBuses[index] || arrivingBuses[index].length === 0)) &&
                    (!this.props.gettingArrivingBuses ? <li>尚未發車</li> : <li>計算中...</li>)
                  }
                </ul>
              </details>
            )
          })
        }
      </div>
    )
  }
}

export default RouteView;