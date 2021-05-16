import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl/dist/mapbox-gl';
import * as helpers from '@turf/helpers';
import jsonData from '../stations.json';
import AppData from '../AppData'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import buffer from '@turf/buffer'
import nearestPoint from '@turf/nearest-point';
import distance from '@turf/distance';
import { disableBodyScroll } from 'body-scroll-lock';
import RouteModal from '../modals/RouteModal';
import './StationView.css'

class StationView extends React.Component {

  route = null;
  color = null;
  direction = null;
  stationMap = null;
  stationData = JSON.parse(JSON.stringify(jsonData));
  stationShownOnMap = {};
  focusedStation = null;
  isMapMoving = null;
  mapCenter = null;
  fetchController = new AbortController();

  constructor(props) {
    super(props);
    this.state = {
      isModalVisible: false,
      isStationLoaded: false,
      isStationReady: false,
      isZoomTooSmall: true,
      currentList: 'nearest',
      nearestStationList: [],
      routesShowing: 5,
      shouldModalBeShown: false,
    }
  }

  focusToMarker = (marker) => {
    for (let sta of Object.values(this.stationShownOnMap)) {
      if (sta.marker === marker) {
        marker.getElement().style.opacity = 1;
        marker.getElement().style.zIndex = 998;
      } else {
        sta.marker.getElement().style.opacity = 0.2;
        sta.marker.getElement().style.removeProperty('z-index');
      }
    }
  }

  getStationData(route, direction) {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/bus?routeName=${route}&dir=${direction}`,{signal: this.fetchController.signal})
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json();
      } else {
          throw new Error('Server/Network Error: ' + response.status);
      }
    })
    .then(data => {
      this.props.handleNetworkError(false);
      this.setState({
        busData: data.data
      }, () => this.isDataReady.busData = true);
    })
    .catch(error => {
      console.log(error);
      if (error instanceof TypeError) {
        this.isDataReady.busData = true;
        this.props.handleNetworkError(true);
      }
    });
  }

  handleListChange = (list) => {
    this.setState({
      currentList: list,
    }, () => {
      const details = document.querySelectorAll('details');
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
    })
  }

  hideStation() {
    for (let sta of Object.values(this.stationShownOnMap)) {
      if(sta.marker != null) {
        sta.marker.getElement().style.opacity = 0;
        setTimeout(() => sta.marker.remove(), 500)
      }
    }
    this.focusedStation = null;
    this.stationShownOnMap = {};
    this.setState({
      isStationLoaded: false,
      isStationReady: false,
      isZoomTooSmall: true,
      nearestStationList: {},
      routesShowing: 5,
    }, () => document.querySelector('#station-view').dispatchEvent(new Event('scroll')));
  }

  returnHome = () => {
    this.route = null;
    this.color = null;
    this.stationIndex = null;
    this.setState({
      shouldModalBeShown: false
    });
    document.querySelector('#station-route-modal .route-navbar')?.classList.toggle('stuck', false);
  }

  requestRoute = (route,color,direction,index=0) => {
    this.color = color;
    this.route = route;
    this.direction = direction;
    this.stationIndex = index;
    this.setState({shouldModalBeShown: true})
  }

  setNumberOfRoutesShowing = (n) => {
    this.setState({
      routesShowing: n,
    })
  }

  showStation(polygon) {
    for (let [code, station] of Object.entries(this.stationData)) {
      let staLoc = [parseFloat(station.longitude), parseFloat(station.latitude)]
      if (booleanPointInPolygon(staLoc, polygon)) {
        if (!this.stationShownOnMap[code]) {
          let element = <div onClick={() => {
            this.stationMap.flyTo({center: staLoc});
          }} className={`station-marker${AppData.mainStations.includes(code.split('/')[0]) ? ' main-station' : ''}`}></div>
          let container = document.createElement('div');
          ReactDOM.render(element, container);
          let staMarker = new mapboxgl.Marker({element: container}).setLngLat(staLoc).addTo(this.stationMap);
          this.stationShownOnMap[code] = {marker: staMarker, data: station};
          staMarker.getElement().style.opacity = 0;
          setTimeout(() => staMarker.getElement().style.opacity = 0.2, 50)
        }
      } else {
        if (this.stationShownOnMap[code]) {
          this.stationShownOnMap[code].marker.getElement().style.opacity = 0;
          setTimeout(() => {
            if (this.stationShownOnMap[code]) {
              this.stationShownOnMap[code].marker.remove();
              delete this.stationShownOnMap[code];
            }
          }, 250)
        }
      }
    }
    setTimeout(() => {
      let pointsCollection = helpers.featureCollection(Object.values(this.stationShownOnMap).map(station => {
        return helpers.point(station.marker.getLngLat().toArray())
      }))
      let index;
      let stationShownOnMapEntries;
      if (pointsCollection.features.length > 0) {
        index = nearestPoint(this.stationMap.getCenter().toArray(), pointsCollection).properties.featureIndex;
        for (let [code,station] of Object.entries(this.stationShownOnMap)) {
          let from = helpers.point(this.stationMap.getCenter().toArray());
          let to = helpers.point([parseFloat(station.data.longitude), parseFloat(station.data.latitude)]);
          let d = distance(from, to);
          this.stationShownOnMap[code].distanceToCenter = d;
        }
        stationShownOnMapEntries = Object.entries(this.stationShownOnMap).sort((a,b) => a[1].distanceToCenter > b[1].distanceToCenter ? 1 : (a[1].distanceToCenter < b[1].distanceToCenter ? -1 : 0));
        for (let sta of Object.values(this.stationShownOnMap)) {
          if (sta.marker !== Object.values(this.stationShownOnMap)[index].marker) {
            sta.marker.getElement().style.opacity = 0.2;
            sta.marker.getElement().style.removeProperty('z-index');
          } else {
            sta.marker.getElement().style.opacity = 1;
            sta.marker.getElement().style.zIndex = 998;
            this.focusedStation = sta.marker;
          }
        }
      } else {
        this.focusedStation = null;
      }
      this.center.getElement().style.opacity = 1;
      document.querySelector('#station-map .center').style.animation = 'none'
      this.setState({
        isStationReady: true,
        isStationLoaded: true,
        nearestStationList: stationShownOnMapEntries,
        routesShowing: (this.state.nearestStationList?.[0]?.[0] === stationShownOnMapEntries?.[0]?.[0]) ? this.state.routesShowing : 5,
      });
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

  initMap() {
    let mapStyle = 'mapbox://styles/matthewngan/ckl22d4c40lj019qooa3513mb';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mapStyle = 'mapbox://styles/matthewngan/ckl22uo2n0t2817mvzzhiakwk';
    }
    this.stationMap = new mapboxgl.Map({
      container: 'station-map',
      style: mapStyle, // stylesheet location
      center: [113.5622406,22.166422], // starting position [lng, lat]
      zoom: 11.5, // starting zoom
      minZoom: 10.5,
      maxZoom: 18.5,
      dragRotate: false,
      touchPitch: false,
    });
    this.stationMap.touchZoomRotate.disableRotation();
    this.stationMap.addControl(
      new mapboxgl.GeolocateControl({
        fitBoundsOptions: {
          maxZoom: 16.5
        },
        positionOptions: {
          enableHighAccuracy: true
        },
      })
    );
    this.stationMap.on('load', () => {
      let centerElement = <div className='center'></div>
      let centerContainer = document.createElement('div')
      ReactDOM.render(centerElement, centerContainer);
      this.center = new mapboxgl.Marker({element: centerContainer}).setLngLat(this.stationMap.getCenter().toArray()).addTo(this.stationMap)
      this.center.getElement().style.zIndex = 999;
      document.querySelector('#station-view').dispatchEvent(new Event('scroll'))
      this.stationMap.on('move', () => {
        let orgLng = this.center.getLngLat().toArray()[0]; let orgLat = this.center.getLngLat().toArray()[1];
        let newLng = this.stationMap.getCenter().toArray()[0]; let newLat = this.stationMap.getCenter().toArray()[1];
        if (orgLng !== newLng && orgLat !== newLat) {
          this.center.setLngLat(this.stationMap.getCenter().toArray())
          this.center.getElement().style.opacity = 0.5;
          if (this.focusedStation) {
            this.focusedStation.getElement().style.opacity = 0.2;
          }
          this.setState({
            isStationLoaded: false
          });
          if (this.isMapMoving) clearTimeout(this.isMapMoving);
          this.isMapMoving = setTimeout(() => {
            if (this.props.currentView == 'station') {
              if (this.stationMap.getZoom() > 15.5) {
                this.setState({
                  isZoomTooSmall: false,
                  isStationLoaded: false
                });
                let center = helpers.point(this.center.getLngLat().toArray());
                let buffered = buffer(center, 0.25);
                this.showStation(buffered);
              } else {
                this.center.getElement().style.opacity = 1;
                document.querySelector('#station-map .center').style.animation = 'none'
                setTimeout(() => document.querySelector('#station-map .center').style.animation = '0.15s bounce linear', 1);
                this.hideStation();
              }
            }
          }, 250);;
        }
      })
    })
  }

  componentDidMount() {
    this.initMap();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',
      () => {
        let mapStyle = 'mapbox://styles/matthewngan/ckjzsnvju0uqx17o6891qzch5';
        if (window?.matchMedia && window?.matchMedia('(prefers-color-scheme: dark)')?.matches) {
          mapStyle = 'mapbox://styles/matthewngan/ckjzsftuo0uik17o62fm4oahc';
        }
        this.stationMap?.setStyle(mapStyle);
      }
    );
    disableBodyScroll(document.querySelector('#station-view'));
    document.querySelector('#station-view').addEventListener('scroll', () => {
      document.querySelector('#station-map').style.height = `calc(var(--view-height) - ${document.querySelector('#station-view').scrollTop}px - ${document.querySelector('.station-info-list nav')?.offsetHeight || 0}px)`
      window.dispatchEvent(new Event('resize'));
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.currentView !== 'station') {
      document.querySelector('#station-view').dispatchEvent(new Event('scroll'));
    }
  }

  componentWillUnmount() {
    this.stationMap.remove();
    this.stationMap = null;
  }

  render() {
    return (
      <div className={`view${this.props.currentView === 'station' ? ' active' : ''}`} id='station-view'>
        <header className='view-header-top fixed-top row justify-content-md-center'>
          <h6 className='col-auto'>站點查詢</h6>
        </header>
        <div id='station-map'></div>
        {!this.state.isZoomTooSmall && 
        <StationInfoList
          calculateTime={this.props.calculateTime}
          setNumberOfRoutesShowing={this.setNumberOfRoutesShowing}
          routesShowing={this.state.routesShowing}
          focusToMarker={this.focusToMarker}
          handleListChange={this.handleListChange}
          nearestStationList={this.state.nearestStationList}
          isStationReady={this.state.isStationReady}
          isStationLoaded={this.state.isStationLoaded}
          currentList={this.state.currentList}
          handleNetworkError={this.props.handleNetworkError}
          requestRoute={this.props.toggleRouteModal}></StationInfoList>}
        <ZoomTooSmallNotifs isZoomTooSmall={this.state.isZoomTooSmall}></ZoomTooSmallNotifs>
      </div>
    )
  }

}

class StationInfoList extends React.Component {

  stationData = JSON.parse(JSON.stringify(jsonData));
  intervals = [];

  constructor(props) {
    super(props);
    this.state = {
      stationRTData: {}
    }
  }

  getStationRTData(code) {
    for (let route of this.stationData[code].routes) {
      // let busInfoLocations = this.state?.locationData?.busInfoList;
      // if (busInfoLocations && this.state?.routeTraffic) {
        fetch(`${AppData?.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/routestation/bus?routeName=${route.routeName}&dir=${route.direction}`)
        .then(response => {
          if(response?.status >= 200 && response?.status < 300) {
              return response?.json();
          } else {
              throw new Error('Server/Network Error: ' + response?.status);
          }
        })
        .then(data => {
          let index = route?.stationIndex;
          let busData = data?.data;
          let stationBefore = busData?.routeInfo?.slice(0, index+1)?.reverse();
          let count = 0;
          let tempArr = [];
          for (let i = 0; i < index+1; i++) {
            for (let comingBus of stationBefore[i]?.busInfo) {
              if (count < 1) {
                if ((i === 0 && comingBus?.status === 0) || i !== 0) {
                  // let routeTraffic = routeTraffic[index-i-1]?.routeTraffic;
                  tempArr?.push({
                    'plate': `${comingBus?.busPlate?.substring(0,2)}-${comingBus?.busPlate?.substring(2,4)}-${comingBus?.busPlate?.substring(4,6)}`,
                    // 'plate': comingBus?.busPlate,
                    'speed': comingBus?.speed,
                    'stopsRemaining': i,
                    // 'durationGet': true,
                    // 'duration': this.props?.calculateTime(routeTraffic,index-i,index,[busInfoLocations?.filter(bus => bus?.busPlate === comingBus?.busPlate)[0]?.longitude,busInfoLocations?.filter(bus => bus?.busPlate === comingBus?.busPlate)[0]?.latitude],comingBus),
                    // 'routeTraffic': routeTraffic,
                    // 'location': [busInfoLocations?.filter(bus => bus?.busPlate === comingBus?.busPlate)[0]?.longitude,busInfoLocations?.filter(bus => bus?.busPlate === comingBus?.busPlate)[0]?.latitude],
                    // 'currentStation': index - i,
                  });
                  count++;
                }
              }
            }
          }
          this.setState(prevState => ({
            stationRTData: {
              ...prevState?.stationRTData,
              [code]: {
                ...prevState?.stationRTData[code],
                [route.routeName]: tempArr
              },
            }
          }));
          console.log(this.state.stationRTData);
        })
      }
    return 0;
  }

  render() {
    return(
      <div className={`station-info-list${this.props.isStationLoaded ? ' loaded' : ''}`}>
        <nav className='row'>
          <span className={`col${this.props.currentList === 'nearest' ? ' active' : ''}`} onClick={() => this.props.handleListChange('nearest')}>附近站站</span>
          {/* <span className={`col${this.props.currentList === 'favorites' ? ' active' : ''}`} onClick={() => this.props.handleListChange('favorites')}>已收藏站點</span> */}
        </nav>
        {/* {
          this.props.currentList === 'nearest' ? */
          <div className='main-list'>
            {
              this.props.nearestStationList?.length > 0 ? this.props.nearestStationList.map(sta => {
                return <details id={sta[0]} key={sta[0]} onToggle={() => {
                  console.log('toggled details')
                  if (document.getElementById(sta[0])?.open) {
                    this.getStationRTData(sta[0]);
                    if (this.intervals[sta[0]] != null) {
                      clearInterval(this.intervals[sta[0]]);
                    }
                    this.intervals[sta[0]] = setInterval(() => {
                      if (document.getElementById(sta[0])?.open) this.getStationRTData(sta[0]);
                      else {
                        clearInterval(this.intervals?.[sta[0]]);
                      };
                      console.log(this.intervals);
                    }, 10000);
                  } else {
                    clearInterval(this.intervals?.[sta[0]]);
                  }
                }}>
                  <summary className='station-list-summary' onClick={() => {this.props.setNumberOfRoutesShowing(5);this.props.focusToMarker(sta[1].marker);}}>
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
                      sta[1].data.routes.slice(0,this.props.routesShowing).map(route => 
                      <li className={`bus-block ${route.color.toLowerCase()}`} key={route.routeName + '-' + route.direction + '-' + route.stationIndex}>
                        <div style={{fontSize: '2rem'}} className={`route-name big-bus ${route.color.toLowerCase()}`}>{route.routeName}</div>
                        <div className='to-station'><span>前往</span><span style={{fontWeight: 'bold', fontSize: '1.2em'}}>{route.directionF}</span></div>
                        <button className='btn btn-success' onClick={
                          () => {
                            this.props.requestRoute(route.routeName,route.color.toLowerCase(),true,route.direction,route.stationIndex,null,true);
                          }
                        } style={
                          {
                            marginLeft: 'auto',
                            color: 'white',
                            transform: 'scale(0.9)',
                          }
                        }>{this.state?.stationRTData?.[sta[0]]?.[route.routeName]?.[0]?.stopsRemaining != null ?
                          <span style={{fontWeight: 'bold', color: 'white', fontSize: '1.5rem'}}>{this.state?.stationRTData?.[sta[0]]?.[route.routeName]?.[0]?.stopsRemaining} 站</span>
                          : '即時資訊'}</button>
                      </li>
                      )
                    }
                  </ul>
                  {
                    sta[1].data.routes.length > this.props.routesShowing &&
                    <div className='btn other-routes' onClick={() => this.props.setNumberOfRoutesShowing(this.props.routesShowing + 5)}>查看此站另外 {Math.min(sta[1].data.routes.length - this.props.routesShowing, 5)} 條路線...</div>
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
}

class ZoomTooSmallNotifs extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className={`notifs text-center${this.props.isZoomTooSmall ? ' shown' : ''}`}>
        <div className='notifs-container'>
          <p>放大地圖以查看巴士站</p>
        </div>
      </div>
    );
  }
}

export default StationView;
