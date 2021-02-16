import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl/dist/mapbox-gl';
import * as helpers from '@turf/helpers';
import jsonData from '../stations.json';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import buffer from '@turf/buffer'
import bbox from '@turf/bbox';
import bboxPolygon from '@turf/bbox-polygon';
import nearestPoint from '@turf/nearest-point';
import distance from '@turf/distance';
import { disableBodyScroll } from 'body-scroll-lock';
import './StationView.css'

class StationView extends React.Component {

  stationMap = null;
  stationData = JSON.parse(JSON.stringify(jsonData));
  stationShownOnMap = {};
  focusedStation = null;
  isMapMoving = null;
  mapCenter = null;

  constructor(props) {
    super(props);
    this.state = {
      isStationLoaded: false,
      isStationReady: false,
      isZoomTooSmall: true,
      currentList: 'nearest',
      nearestStationList: {},
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
    })
  }

  showStation(polygon) {
    for (let [code, station] of Object.entries(this.stationData)) {
      let staLoc = [parseFloat(station.longitude), parseFloat(station.latitude)]
      if (booleanPointInPolygon(staLoc, polygon)) {
        if (!this.stationShownOnMap[code]) {
          let element = <div className="station-marker"></div>
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
      });
      setTimeout(() => {
        document.querySelector('#station-map .center').style.animation = '0.15s bounce linear';
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
        if (details[0]) {
          details[0].open = true;
          if (document.querySelector('#station-view').scrollTop < document.querySelector('.main-list details:first-child summary').offsetHeight)
          document.querySelector('#station-view').scroll({top: document.querySelector('.main-list details:first-child').offsetHeight - 1, behavior: 'smooth'});
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
      minZoom: 11.5,
      maxZoom: 18.5,
      maxBounds: [
        [
          113.51263046264648,
          22.099796009091584
        ],
        [
          113.61064910888672,
          22.229520549100275
        ]
      ],
      dragRotate: false,
      touchPitch: false,
    });
    this.stationMap.touchZoomRotate.disableRotation();
    this.stationMap.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true
      })
    );
    this.stationMap.on('load', () => {
      let centerElement = <div className="center"></div>
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
        this.stationMap.remove();
        this.stationMap = null;
        this.initMap();
      }
    );
    disableBodyScroll(document.querySelector('#station-view'));
    document.querySelector('#station-view').addEventListener('scroll', () => {
      document.querySelector('#station-map').style.height = `calc(var(--view-height) - ${document.querySelector('#station-view').scrollTop}px - ${document.querySelector('.station-info-list nav').offsetHeight}px)`
      window.dispatchEvent(new Event('resize'));
    })
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
        <StationInfoList focusToMarker={this.focusToMarker} handleListChange={this.handleListChange} nearestStationList={this.state.nearestStationList} isStationReady={this.state.isStationReady} isStationLoaded={this.state.isStationLoaded} currentList={this.state.currentList}></StationInfoList>
        <ZoomTooSmallNotifs isZoomTooSmall={this.state.isZoomTooSmall}></ZoomTooSmallNotifs>
      </div>
    )
  }

}

class StationInfoList extends React.Component {
  constructor(props) {
    super(props)
    this.state = {}
  }

  render() {
    return(
      <div className={`station-info-list${this.props.isStationReady ? ' shown' : ''}${this.props.isStationLoaded ? ' loaded' : ''}`}>
        <nav className='row'>
          <span className={`col${this.props.currentList === 'nearest' ? ' active' : ''}`} onClick={() => this.props.handleListChange('nearest')}>附近站站</span>
          <span className={`col${this.props.currentList === 'favorites' ? ' active' : ''}`} onClick={() => this.props.handleListChange('favorites')}>已收藏站點</span>
        </nav>
        {
          this.props.currentList === 'nearest' ?
          <div className="main-list">
            {
              this.props.nearestStationList?.length > 0 ? this.props.nearestStationList.map(sta => {
                return <details key={sta[0]}>
                  <summary className="station-list-summary" onClick={() => this.props.focusToMarker(sta[1].marker)}>
                    <div className="title">
                      <div className="title-code">{sta[0]}</div>
                      <div className="title-name">{sta[1].data.name}<small className="text-muted"> {Math.round(sta[1].distanceToCenter*1000)}m</small></div>
                      {
                        sta[1].data.laneName && 
                        <code className={`lane ${sta[0].split('/')[0]} ${sta[1].data.laneName[0]}`}>{sta[1].data.laneName}</code>
                      }
                    </div>
                    <div className="routes">
                      {
                        sta[1].data.routes.map(route => <span key={route.routeName + '-' + route.direction}>{route.routeName} </span>)
                      }
                    </div>
                  </summary>
                  <ul>
                    {
                      sta[1].data.routes.map(route => <li key={route.routeName + '-' + route.direction}>{route.routeName}-{route.direction}</li>)
                    }
                  </ul>
                </details>
              })
              : <div className='no-station'>附近沒有任何車站</div>
            }
            </div>
          : 
          <div className="main-list">
            <details>
              <summary>favorite_station</summary>
            </details>
            <details>
              <summary>favorite_station</summary>
            </details>
            <details>
              <summary>favorite_station</summary>
            </details>
            <details>
              <summary>favorite_station</summary>
            </details>
            <details>
              <summary>favorite_station</summary>
            </details>
          </div>
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
        <div className="notifs-container">
          <p>放大地圖以查看巴士站</p>
        </div>
      </div>
    );
  }
}

export default StationView;