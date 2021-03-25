import './App.css';
import React from 'react';
import RouteView from './views/RouteView'
import AboutView from './views/AboutView'
import StationView from './views/StationView'
import { disableBodyScroll, clearAllBodyScrollLocks } from 'body-scroll-lock';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      currentView: 'route',
      networkError: false,
      isReloading: false,
      isModalVisible: false,
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
    let thistraffic = parseFloat(traffic[nextStop-1].routeTraffic) > 0 ? parseFloat(traffic[nextStop-1].routeTraffic) : 2.25
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
      let thistraffic = parseFloat(route.routeTraffic) > 0 ? parseFloat(route.routeTraffic) : 2.25;
      if (route.realTraffic != null) {
        thistraffic = parseFloat(route.realTraffic);
      }
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

  changeView = (view) => {
    this.setState({
      currentView: view,
    })
    setTimeout(() => {
      let e = new Event('resize')
      window.dispatchEvent(e);
    },5)
  }

  handleNetworkError = (b) => {
    this.setState({networkError: b})
  }

  reloadHandler = (b) => {
    this.setState({isReloading: b})
    if (b) {
      setTimeout(() => window.location.reload(), 500);
    }
  }

  componentDidMount() {
    this.modalList = document.querySelectorAll('.modal');
    for (let modal of this.modalList) {
      const observer = new MutationObserver(() => {
        this.setState({isModalVisible: document.querySelector('.modal.shown') !== null});
      });
      observer.observe(modal,{attributes: true});
    }
  }

  componentDidUpdate(prevProps,prevState) {
    if (prevState.currentView !== this.state.currentView) {
      document.querySelector('#app').scroll({top: 0});
    }
  }

  render() {
    return (
      <div id='app'>
        <RouteView isModalVisible={this.state.isModalVisible} calculateTime={this.calculateTime} handleNetworkError={this.handleNetworkError} currentView={this.state.currentView}></RouteView>
        <AboutView currentView={this.state.currentView}></AboutView>
        <StationView isModalVisible={this.state.isModalVisible} calculateTime={this.calculateTime} handleNetworkError={this.handleNetworkError} currentView={this.state.currentView}></StationView>
        <ViewsTab currentView={this.state.currentView} changeView={this.changeView}></ViewsTab>
        <SkipWaitingNotifs isReloading={this.state.isReloading} reload={this.reloadHandler}></SkipWaitingNotifs>
        <InternetErrorNotifs networkError={this.state.networkError} isReloading={this.state.isReloading} reload={this.reloadHandler}></InternetErrorNotifs>
      </div>
    );
  }
}

class ViewsTab extends React.Component {

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    setTimeout(() => {
      document.querySelector('#app').scroll({top: 2});
      document.querySelector('#root').scroll({top: 2});
      document.querySelector('body').scroll({top: 2});
    }, 50);
    disableBodyScroll(document.querySelector('#app'));
  }

  render() {
    return (
      <div className='tabs row fixed-bottom'>
        <div className={`col-4 tab${this.props.currentView === 'route' ? ' active' : ''}`} onClick={() => this.props.changeView('route')}>
          <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-list-ol' viewBox='0 0 16 16'>
            <path fillRule='evenodd' d='M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z'/>
            <path d='M1.713 11.865v-.474H2c.217 0 .363-.137.363-.317 0-.185-.158-.31-.361-.31-.223 0-.367.152-.373.31h-.59c.016-.467.373-.787.986-.787.588-.002.954.291.957.703a.595.595 0 0 1-.492.594v.033a.615.615 0 0 1 .569.631c.003.533-.502.8-1.051.8-.656 0-1-.37-1.008-.794h.582c.008.178.186.306.422.309.254 0 .424-.145.422-.35-.002-.195-.155-.348-.414-.348h-.3zm-.004-4.699h-.604v-.035c0-.408.295-.844.958-.844.583 0 .96.326.96.756 0 .389-.257.617-.476.848l-.537.572v.03h1.054V9H1.143v-.395l.957-.99c.138-.142.293-.304.293-.508 0-.18-.147-.32-.342-.32a.33.33 0 0 0-.342.338v.041zM2.564 5h-.635V2.924h-.031l-.598.42v-.567l.629-.443h.635V5z'/>
          </svg>
          <div>路線</div>
        </div>
        <div className={`col-4 tab${this.props.currentView === 'station' ? ' active': ''}`} onClick={() => this.props.changeView('station')}>
          <div>
            {
              this.props.currentView !== 'station' ?
              <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-geo-alt' viewBox='0 0 16 16'>
                <path d='M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A31.493 31.493 0 0 1 8 14.58a31.481 31.481 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94zM8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10z'/>
                <path d='M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/>
              </svg>
              : <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-geo-alt-fill' viewBox='0 0 16 16'>
                <path d='M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z'/>
              </svg>
            }
          </div>
          <div>站點</div>
        </div>
        <div className={`col-4 tab${this.props.currentView === 'about' ? ' active': ''}`} onClick={() => this.props.changeView('about')}>
          <div>
            {
              this.props.currentView !== 'about' ?
              <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-info-circle' viewBox='0 0 16 16'>
                <path d='M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z'/>
                <path d='M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'/>
              </svg>
              : <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-info-circle-fill' viewBox='0 0 16 16'>
                <path d='M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z'/>
              </svg>
            }
          </div>
          <div>關於</div>
        </div>
        {/* <div className={`col-4 tab`}>
          <div>
            {
              this.props.currentView !== 'station' ?
              <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-geo-alt' viewBox='0 0 16 16'>
                <path d='M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A31.493 31.493 0 0 1 8 14.58a31.481 31.481 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94zM8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10z'/>
                <path d='M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/>
              </svg>
              : <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-geo-alt-fill' viewBox='0 0 16 16'>
                <path d='M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z'/>
              </svg>
            }
          </div>
          <div>開發中</div>
        </div> */}
        {/* <div className='col-3 tab'>
          <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-three-dots' viewBox='0 0 16 16'>
            <path d='M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z'/>
          </svg>
          <div>開發中</div>
        </div> */}
      </div>
    );
  }
}

class SkipWaitingNotifs extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className={`notifs text-center`} id='update-notifs'>
        <div className='notifs-container'>
          <p>有新版本可供更新</p>
          <ReloadButton isReloading={this.props.isReloading} reload={this.props.reload} text='重新載入'></ReloadButton>
        </div>
      </div>
    );
  }
}

class InternetErrorNotifs extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className={`notifs text-center${this.props.networkError ? ' shown' : ''}`}>
        <div className='notifs-container'>
          <p>網路連接發生錯誤，請檢查網路</p>
        </div>
      </div>
    );
  }
}

class ReloadButton extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (!this.props.isReloading) {
      return <button className='btn reload' aria-label='Retry' onClick={this.props.reload}>{this.props.text}</button>;
    } else {
      return <p>載入中...</p>;
    }
  }
}

export default App;
