import React from 'react';
import AppData from '../AppData.js'
import PullToRefresh from 'pulltorefreshjs'
import { disableBodyScroll, clearAllBodyScrollLocks } from 'body-scroll-lock';
import * as turfHelper from '@turf/helpers'
import turfbooleanPointInPolygon from '@turf/boolean-point-in-polygon';
import turfbbox from '@turf/bbox';
import mapboxgl from 'mapbox-gl';

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
    .then(response => response.json())
    .then(data => {
      let messages = [];
      for (let item of data.data) {
        var startTime = Date.parse(item.startTime.replace(' ','T') + '+08:00');
        var expireTime = Date.parse(item.expireTime.replace(' ','T') + '+08:00');
        var now = Date.now();
        if (startTime < now && expireTime > now) {
          messages.push(item.message);
        }
        this.setState({messages: messages});
      }
    })
    .catch(() => {
      this.props.handleNetworkError();
    })
  }

  fetchRoutes() {
    this.setState({busList: []})
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getRouteAndCompanyList.html?lang=zh_tw`)
    .then(response => response.json())
    .then(data => {
      this.setState({busList: data.data.routeList});
    })
    .catch(() => {
      this.setState({noInternet: true})
    });
  }

  returnHome = () => {
    if (!this.state.noInternet) {
      clearAllBodyScrollLocks();
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
        return !this.triggerElement.scrollTop && !document.querySelector('.modal.shown');
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
      <div className='view active' id='route-view'>
        <header className='view-header-top route-view-header fixed-top row justify-content-md-center'>
          <h6 className='col-auto'>路線查詢</h6>
          <div className='route-options'>
            {this.state.messages.length > 0 && 
              <button className='route-info btn' id='toggleInfoBox'>
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
              {this.state.messages.map((message,index) => <li key={index}>{message}</li>)}
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
                {this.state.busList.map((route,index) => <button key={index} className={`route-bus col-md-1 col-2 btn ${route.color.toLowerCase()}`} onClick={() => this.requestRoute(route.routeName, route.color)}>{route.routeName}</button>)}
              </div>
              :
              <div className='route-loading'>
                載入中...
              </div>
            }
          </div>
        </div>
        <RouteModal route={this.route} color={this.color} shown={this.state.shouldModalBeShown} returnHome={this.returnHome} calculateTime={this.calculateTime}></RouteModal>
      </div>
    )
  }
}

class RouteModal extends React.Component {

  intervals = [];
  fetchController = new AbortController();

  constructor(props) {
    super(props);
    this.state = {
      arrivingBuses: {},
      busColor: null,
      busRoute: null,
      busData: null,
      busDirection: 0,
      directionAvailable: '2',
      isDataReady: {
        bridgeData: false,
        busData: false,
        locationData: false,
        routeData: false,
        routeTraffic: false,
      },
      isMapEnabled: false,
      locationData: null,
      routeData: null,
      routeTraffic: null,
      shown: false,
    }
  }

  busIconSrc = () => { return require(`../images/icons/${this.state.busColor.toLowerCase()}-bus-icon.png`).default }

  changeDirection() {

  }

  disableMap() {

  }

  enableMap() {

  }

  fetchBusData() {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/bus?routeName=${this.state.busRoute}&dir=${this.state.busDirection}`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.statusText == 'OK' && response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.setState(prevState => ({
        isDataReady: {
          ...prevState.isDataReady,
          busData: true,
        },
        busData: data.data
      }))
    })
    .catch(error => {
      console.log(error);
    });
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/location?routeName=${this.state.busRoute}&dir=${this.state.busDirection}&lang=zh-tw`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.statusText == 'OK' && response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.setState(prevState => ({
        isDataReady: {
          ...prevState.isDataReady,
          locationData: true,
        },
        locationData: data.data,
      }))
    })
    .catch(error => {
      console.log(error);
    });
  }

  fetchRouteData() {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html?routeName=${this.state.busRoute}&dir=${this.state.busDirection}&lang=zh-tw`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.statusText == 'OK' && response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.setState(prevState => ({
        isDataReady: {
          ...prevState.isDataReady,
          routeData: true,
        },
        routeData: data.data,
        directionAvailable: data.data.direction,
        isRouteChanged: (data.data.routeInfo.filter(sta => sta.suspendState === '1').length != 0)
      }))
    })
    .catch(error => {
      console.log(error);
    });
  }

  fetchTrafficData() {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37011/its/Bridge/getTime.html?lang=zh_tw`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.statusText == 'OK' && response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.setState(prevState => ({
        isDataReady: {
          ...prevState.isDataReady,
          bridgeData: true,
        },
        bridgeData: data.data.timeArray,
      }))
    })
    .catch(error => {
      console.log(error);
    });
    
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/ddbus/common/supermap/route/traffic?routeCode=${'0'.repeat(5-this.state.busRoute.length) + this.state.busRoute}&direction=${this.state.busDirection}&indexType=00&device=web`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.statusText == 'OK' && response.status >= 200 && response.status < 300) {
          return response.json()
      } else {
          throw new Error('Server/Network Error: ' + response.status)
      }
    })
    .then(data => {
      this.setState(prevState => ({
        isDataReady: {
          ...prevState.isDataReady,
          routeTraffic: true,
        },
        routeTraffic: data.data,
      }))
    })
    .catch(error => {
      console.log(error);
    });
  }

  getArrivingBuses(index = this.currentlyOpenedIndex) {
    this.waitUntil(() => {
      let busInfoLocations = this.state.locationData.busInfoList;
      if (busInfoLocations && this.state.routeTraffic) {
        let stationBefore = this.state.busData.routeInfo.slice(0, index).reverse();
        let count = 0;
        let tempArr = [];
        for (let i = 0; i < index; i++) {
          for (let comingBus of stationBefore[i].busInfo) {
            if (count < 3) {
              var routeTraffic = this.state.routeTraffic[index-i-1].routeTraffic;
              tempArr.push({
                'plate': `${comingBus.busPlate.substring(0,2)}-${comingBus.busPlate.substring(2,4)}-${comingBus.busPlate.substring(4,6)}`,
                // 'plate': comingBus.busPlate,
                'speed': comingBus.speed,
                'distanceToThis': i + 1,
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
        // this.focusStation();
      }
    },true)
  }

  removeInterval() {
    for (let interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }

  returnHome() {
    this.removeInterval();
    this.fetchController.abort();
    this.setState({
      busColor: null,
      busRoute: null,
      busData: null,
      busDirection: 0,
      isDataReady: {
        bridgeData: false,
        busData: false,
        locationData: false,
        routeData: false,
        routeTraffic: false,
      },
      directionAvailable: '2',
      isMapEnabled: false,
      locationData: null,
      routeData: null,
      shown: false,
    })
  }

  requestRoute() {
    this.fetchRouteData();
    this.fetchBusData();
    this.fetchTrafficData();
    var dataInterval = setInterval(() => {
      this.fetchBusData();
      // this.setupBusMarkersOnMap();
      // this.getArrivingBuses(this.currentlyOpenedIndex);
    }, 10000);
    var trafficInterval = setInterval(() => {
      this.fetchTrafficData();
      // this.setupRoutesOnMap();
      // this.getArrivingBuses(this.currentlyOpenedIndex);
    },30000);
    this.intervals = [dataInterval, trafficInterval];
  }

  scrollToWarning() {

  }

  toggleIndex = (index) => {
    this.currentlyOpenedIndex = index;
    this.getArrivingBuses(this.currentlyOpenedIndex);
    // let details = document.querySelectorAll('details');
    // if (this.currentPopup != undefined && this.stationLayerGroup) this.stationLayerGroup.slice().reverse()[this.currentPopup].getPopup().remove();
    // if (details[index] && details[index].hasAttribute('open')) {
    //   this.focusingStation = true;
    //   if (this.mapEnabled && this.busMap && this.stationLayerGroup) {
    //     this.stationLayerGroup.slice().reverse()[index].getPopup().addTo(this.busMap);
    //     this.currentPopup = index;
    //   }
    // }
  }

  waitUntil(callback,a=true) {
    setTimeout(() => {
      let condition = [this.state.isDataReady.routeData, this.state.isDataReady.locationData, this.state.isDataReady.busData, this.state.isDataReady.bridgeData]
      if (a) condition.push(this.state.isDataReady.routeTraffic);
      // if (this.mapEnabled) condition.push(this.mapLoaded);
      var b = true;
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

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.shown != this.props.shown) {
      this.setState({
        propsUpdate: true,
        shown: this.props.shown,
        busRoute: this.props.route,
        busColor: this.props.color,
      }, () => {
        if (this.props.shown) {
          this.fetchController = new AbortController();
          this.requestRoute();
        } else {
          this.returnHome();
        }
      });
    } else if (!this.state.propsUpdate) {
      if (prevState.shown != this.state.shown) {
        if (!this.state.shown) {
          this.returnHome();
          this.props.returnHome();
        }
      }
    } else {
      this.setState({
        propsUpdate: false,
      });
    }
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
  }

  render() {
    return (
      <div className={`modal route-modal ${this.state.shown ? 'shown' : ''}`}>
        {
          this.state.shown ?
          <div>
            <RouteModalHeader color={this.state.busColor} route={this.state.busRoute} direction={this.state.busDirection} routeData={this.state.routeData} directionAvailable={this.state.directionAvailable}></RouteModalHeader>
            {this.state.isMapEnabled ? <div id='route-bus-map'></div> : null}
            <div className='route-main-info-container'>
              <div className='route-navbar'>
                <button onClick={() => this.setState({shown: false})} className='col-auto btn' aria-label='Return Button'>
                  <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-arrow-left' viewBox='0 0 16 16'>
                    <path fillRule='evenodd' d='M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z'/>
                  </svg>
                </button>
                {
                  (this.state.routeData && this.state.isMapEnabled) ?
                  <div className="col row route-navbar-title">
                    <div className={`col-auto route-navbar-bus ${this.state.busColor.toLowerCase()}`}>
                      <span>{this.state.busRoute}</span>
                    </div>
                    <div className="route-header h5 col">
                      <span className="route-destination">
                        {AppData.routeMainPoints[this.state.busRoute.toUpperCase()] ? AppData.routeMainPoints[this.state.busRoute.toUpperCase()][this.state.busDirection] : this.state.routeData[0].staName}&nbsp;
                      </span>
                      <span className="route-destination">
                        {
                          this.state.directionAvailable === '2' ?
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" className="bi bi-arrow-repeat" viewBox="0 0 16 16">
                            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                            <path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                          </svg>
                          : <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" className="bi bi-arrow-right" viewBox="0 0 16 16">
                            <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                          </svg>
                        }
                        &nbsp;{AppData.routeMainPoints[this.state.busRoute.toUpperCase()] ? AppData.routeMainPoints[this.state.busRoute.toUpperCase()].slice().reverse()[this.state.busDirection] : this.state.routeData[0].slice().reverse().staName}
                      </span>
                    </div>
                  </div>
                  : null
                }
                <div className="route-option-buttons">
                  {
                    this.state.directionAvailable === '0' &&
                    <button onClick={() => this.changeDirection()} type="button" className="col-auto btn" id="route-changedirection-icon" aria-label="change direction icon button">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" className="bi bi-arrow-down-up" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5zm-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5z"/>
                      </svg>
                    </button>
                  }
                  {
                    this.state.isRouteChanged && 
                    <button className="btn" onClick={() => this.scrollToWarning()}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" className="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 5zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                      </svg>
                    </button>
                  }
                  {
                    this.state.isMapEnabled ?
                    <button className="btn" onClick={() => this.disableMap()}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" className="bi bi-map-fill" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.598-.49L10.5.99 5.598.01a.5.5 0 0 0-.196 0l-5 1A.5.5 0 0 0 0 1.5v14a.5.5 0 0 0 .598.49l4.902-.98 4.902.98a.502.502 0 0 0 .196 0l5-1A.5.5 0 0 0 16 14.5V.5zM5 14.09V1.11l.5-.1.5.1v12.98l-.402-.08a.498.498 0 0 0-.196 0L5 14.09zm5 .8V1.91l.402.08a.5.5 0 0 0 .196 0L11 1.91v12.98l-.5.1-.5-.1z"/>
                      </svg>
                    </button>
                    : <button className="btn" onClick={() => this.enableMap()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" className="bi bi-map" viewBox="0 0 16 16">
                          <path fillRule="evenodd" d="M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.502.502 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103zM10 1.91l-4-.8v12.98l4 .8V1.91zm1 12.98l4-.8V1.11l-4 .8v12.98zm-6-.8V1.11l-4 .8v12.98l4-.8z"/>
                        </svg>
                      </button>
                  }
                </div>
              </div>
              <div className="row">
                {
                  (this.state.routeData && this.state.busData && this.state.routeTraffic) ?
                  <div className="col route-bus-info-container">
                    <RouteStationBlock
                      busIconSrc={this.busIconSrc}
                      busData={this.state.busData}
                      color={this.state.busColor}
                      routeData={this.state.routeData.routeInfo}
                      routeTraffic={this.state.routeTraffic}
                      toggleIndex={this.toggleIndex}
                      arrivingBuses={this.state.arrivingBuses}
                    ></RouteStationBlock>
                  </div>
                  : <div className="route-loading route-bus-info-container">載入中...</div>
                }
              </div>
            </div>
          </div>
          : null
        }
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
            <span className='route-destination'>{AppData.routeMainPoints?.[route.toUpperCase()][direction] || routeData.routeInfo[0].staName}&nbsp;</span>
            <span className="route-destination">
              {
                directionAvailable === '2' ?
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-repeat" viewBox="0 0 16 16">
                  <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                  <path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                </svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-right" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                </svg>
              }
              &nbsp;{AppData.routeMainPoints?.[route.toUpperCase()].slice().reverse()[direction] || routeData.routeInfo.slice().reverse()[0].staName}
            </span>
          </div>
          : <div className="h5 route-header col">
            <span className="route-destination">
              載入中...
            </span>
          </div>
        }
        {
          route.toLowerCase() === 'ap1x' ?
          <span className="col-auto text-muted">機場<br/>快線</span>
          : (route.toLowerCase().includes('ap') ?
            <span className="col-auto text-muted">機場<br/>專線</span>
            : (route.toLowerCase().includes('s') ? 
              <span className="col-auto text-muted">特班車</span>
              : (route.toLowerCase().includes('h') ? 
                <span className="col-auto text-muted">醫院<br/>專線</span>
                : (route.toLowerCase().includes('mt') ?
                  <span className="col-auto text-muted">澳氹<br/>專線</span>
                  : (route.toLowerCase().includes('n') ?
                    <span className="col-auto text-muted">夜間<br/>巴士</span>
                    : (route.toLowerCase().includes('x') ?
                      <span className="col-auto text-muted">快線</span>
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
    const busData = this.props.busData;
    const color = this.props.color;
    const routeData = this.props.routeData;
    const routeTraffic = this.props.routeTraffic;
    const toggleIndex = this.props.toggleIndex;
    return (
      <div className="bus-route-info">
        {
          routeData.map((station,index) => {
            return (
              <details key={index} onToggle={() => toggleIndex(index)}>
                {
                  routeTraffic?.[index] &&
                  <summary className={
                    `route-traffic${index === routeData.length - 1 ? ' last' : ''}
                      ${routeTraffic[index].routeTraffic === '-1' ? ' gray' : ''}
                      ${(parseFloat(routeTraffic[index].routeTraffic) <= 1 && parseFloat(routeTraffic[index].routeTraffic) > 0) ? ' green': ''}
                      ${Math.ceil(parseFloat(routeTraffic[index].routeTraffic)) === 2 ? ' yellow' : ''}
                      ${Math.ceil(parseFloat(routeTraffic[index].routeTraffic)) === 3 ? ' orange' : ''}
                      ${Math.ceil(parseFloat(routeTraffic[index].routeTraffic)) === 4 ? ' red' : ''}
                      ${Math.ceil(parseFloat(routeTraffic[index].routeTraffic)) >= 5 ? ' brown' : ''}`
                    }>
                    <span className={
                      `route-station-dot${busData.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length > 0 ? ' hidden' : ''}`
                      }></span>
                    <span className="route-station-line"></span>
                    <span className="route-station-name">{station.staCode} {station.staName}</span>
                    {
                      busData.routeInfo[index].busInfo.filter((bus) => bus.status === '0').length > 0 &&
                      <span className={`route-station-bus-icon moving ${color.toLowerCase()}`}>
                          {
                            busData.routeInfo[index].busInfo.filter((bus) => bus.status === '0').length > 1 ?
                            <span>{busData.routeInfo[index].busInfo.filter((bus) => bus.status === '0').length}</span>
                            : <img src={busIconSrc} />
                          }
                      </span>
                    }
                    {
                      busData.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length > 0 && 
                      <span className={`route-station-bus-icon ${color.toLowerCase()}`}>
                        {
                          busData.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length > 1 ?
                          <span>{busData.routeInfo[index].busInfo.filter((bus) => bus.status === '1').length}</span>
                          : <img src={busIconSrc} />
                        }
                      </span>
                    }
                    {
                      routeData?.[index]?.suspendState === '1' &&
                      <span className="route-suspended">暫不停靠此站</span>
                    }
                  </summary>
                }
                <ul className="route-arriving-list">
                  {
                    arrivingBuses?.[index]?.slice().reverse().map(arrivingBus => {
                      return (
                        <li key={arrivingBus.plate}>
                          <span><code className={color.toLowerCase()}>{arrivingBus.plate}</code> 距離 {arrivingBus.distanceToThis} 站</span> 
                          <span className={
                            `route-time-remaining route-live
                            ${arrivingBus.routeTraffic === '-1' ? ' gray' : ''}
                            ${parseFloat(arrivingBus.routeTraffic) <= 1 && parseFloat(arrivingBus.routeTraffic) > 0 ? ' green' : ''}
                            ${Math.ceil(parseFloat(arrivingBus.routeTraffic)) === 2 ? ' yellow' : ''}
                            ${Math.ceil(parseFloat(arrivingBus.routeTraffic)) === 3 ? ' orange' : ''}
                            ${Math.ceil(parseFloat(arrivingBus.routeTraffic)) === 4 ? ' red' : ''}
                            ${Math.ceil(parseFloat(arrivingBus.routeTraffic)) >= 5 ? ' brown' : ''}
                            `
                            }>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-broadcast" viewBox="0 0 16 16">
                              <path fillRule="evenodd" d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707zm2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 0 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708zm5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708zm2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707z"/>
                              <path d="M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
                            </svg>
                            {
                              arrivingBus.duration > 30 ?
                              <span> {arrivingBus.duration <= 3600 ? (Math.round((arrivingBus.duration) / 60)) + " 分鐘" : "多於 " + Math.floor((arrivingBus.duration) / 3600) + " 小時"}</span>
                              : <span> 即將進站</span>
                            }
                          </span>
                        </li>
                      )
                    })
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