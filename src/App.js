import './App.css';
import React, { lazy, Suspense } from 'react';
import { disableBodyScroll } from 'body-scroll-lock';
import mapboxgl from '!mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import RouteModal from './modals/RouteModal';

const RouteView = lazy(() => import('./views/RouteView'));
const AboutView = lazy(() => import('./views/AboutView'));
const StationView = lazy(() => import('./views/StationView'));

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

function App(props) {

  const [currentView, setCurrentView] = React.useState('route');
  const [networkError, setNetworkError] = React.useState(false);
  const [isReloading, setIsReloading] = React.useState(false);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [modalroute, setModalRoute] = React.useState(null);
  const [modalcolor, setModalcolor] = React.useState(null);
  const [modalmapswitch, setModalmapswitch] = React.useState(null);
  const [modaldirection, setModaldirection] = React.useState(0);
  const [modalindex, setModalindex] = React.useState(null);
  const [modalmapenabled, setModalmapenabled] = React.useState(null);
  const [noInternet, setNoInternet] = React.useState(false);
  const [shouldRouteModalBeShown, setShouldRouteModalBeShown] = React.useState(false);
  const [allViewDisabled, setAllViewDisabled] = React.useState(false);

  const calculateDistance = (lon1,lat1,lon2,lat2) => {
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
  };

  const calculateTime = (traffic,nextStop,targetStop,loc) => {
    let totaldistance = 0;
    let currentRoutes = [];
    for (let i = 0; i < traffic[nextStop-1].routeCoordinates.split(';').length-1; i++) {
      currentRoutes.push({
        'x': parseFloat(traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[0]),
        'y': parseFloat(traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[1]),
      });
    }
    let index = currentRoutes.findIndex(point => point.x === parseFloat(loc[0]) && point.y === parseFloat(loc[1]));
    for (let i = index; i < traffic[nextStop-1].routeCoordinates.split(';').length-2; i++) {
      if (traffic[nextStop-1].routeCoordinates.split(';')[i] && traffic[nextStop-1].routeCoordinates.split(';')[i+1]) {
        let lon1 = traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[0];
        let lat1 = traffic[nextStop-1].routeCoordinates.split(';')[i].split(',')[1]
        let lon2 = traffic[nextStop-1].routeCoordinates.split(';')[i+1].split(',')[0];
        let lat2 = traffic[nextStop-1].routeCoordinates.split(';')[i+1].split(',')[1];
        totaldistance += calculateDistance(lon1,lat1,lon2,lat2);
      }
    }
    for (let route of traffic.slice(nextStop,targetStop)) {
      for (let i = 0; i < route.routeCoordinates.split(';').length-2; i++) {
        let lon1 = route.routeCoordinates.split(';')[i].split(',')[0]; let lat1 = route.routeCoordinates.split(';')[i].split(',')[1];
        let lon2 = route.routeCoordinates.split(';')[i+1].split(',')[0]; let lat2 = route.routeCoordinates.split(';')[i+1].split(',')[1];
        totaldistance += calculateDistance(lon1,lat1,lon2,lat2);
      }
    }
    let unit = "米";
    if (totaldistance >= 1000) {
      totaldistance = Math.round(totaldistance / 100)/10;
      unit = "公里";
    } else {
      totaldistance = Math.round(totaldistance);
    }
    return `${totaldistance} ${unit}`;
  }

  const changeView = (view) => {
    setCurrentView(view);
    setTimeout(() => {
      let e = new Event('resize')
      window.dispatchEvent(e);
    },5)
  };

  const disableAllView = (b) => {
    setAllViewDisabled(true);
  }

  const handleNetworkError = (b) => {
    setNetworkError(b);
  };

  const reloadHandler = (b) => {
    setIsReloading(b);
    if (b) setTimeout(() => window.location.reload(), 500);
  }

  const returnHome = () => {
    if (!noInternet) {
      setShouldRouteModalBeShown(false);
    }
  }

  const toggleRouteModal = (route,color,map=true,direction=0,index=0,mapenabled=null,b=null) => {
    // for (let e of document.querySelectorAll('.modal')) {
    //   e.classList.remove('shown');
    // }
    // for (let e of document.querySelectorAll('.route-navbar')) {
    //   e.classList.toggle('stuck', false);
    // }
    // for (let e of document.querySelectorAll('.route-modal details')) {
    //   e.removeAttribute('open');
    // }
    setModalRoute(route);
    setModalcolor(color);
    setModalmapswitch(map);
    setModaldirection(direction);
    setModalindex(index);
    setModalmapenabled(mapenabled);
    setShouldRouteModalBeShown(b!=null ? b : !shouldRouteModalBeShown);
  }

  React.useEffect(() => {
    const to = new MutationObserver(() => {
      if (document.querySelectorAll('.modal.shown').length > 0)
      setIsModalVisible(true);
      else setIsModalVisible(false);
    });
    disableBodyScroll(document.querySelector('#app'));
    to.observe(document.querySelector('#app'), {childList: true});
  }, []);

  React.useEffect(() => {
    document.querySelector('#app').scroll({top: 0});
  }, [currentView]);

  return (
    <div id='app'>
      <div id='route-shadow' className={
        `${isModalVisible ? 'route-shadow-shown' : ''}`
      } onClick={() => returnHome()}></div>
      <Suspense fallback={<div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold'}}>載入中...</div>}>
        {shouldRouteModalBeShown &&
          <RouteModal
            id='route-modal'
            route={modalroute}
            color={modalcolor}
            direction={modaldirection}
            index={modalindex}
            mapSwitch={modalmapswitch}
            isMapEnabled={modalmapenabled}
            shown={shouldRouteModalBeShown}
            returnHome={returnHome}
            calculateTime={calculateTime}
            calculateDistance={calculateDistance}
            handleNetworkError={handleNetworkError}
          ></RouteModal>
        }
        <RouteView
          toggleRouteModal={toggleRouteModal}
          isModalVisible={isModalVisible}
          calculateTime={calculateTime}
          handleNetworkError={handleNetworkError}
          currentView={currentView}
          returnHome={returnHome}
          disabled={allViewDisabled}
        ></RouteView>
        <AboutView
          currentView={currentView}
          disabled={allViewDisabled}
        >
        </AboutView>
        <StationView
          toggleRouteModal={toggleRouteModal}
          isModalVisible={isModalVisible}
          calculateTime={calculateTime}
          handleNetworkError={handleNetworkError}
          currentView={currentView}
          disabled={allViewDisabled}
        ></StationView>
        <ViewsTab
          currentView={currentView}
          changeView={changeView}
          disabled={allViewDisabled}
        ></ViewsTab>
        <SkipWaitingNotifs
          isReloading={isReloading}
          reload={reloadHandler}
        ></SkipWaitingNotifs>
        <InternetErrorNotifs
          networkError={networkError}
          isReloading={isReloading}
          reload={reloadHandler}
        ></InternetErrorNotifs>
      </Suspense>
    </div>
  );
}

function ViewsTab(props) {

  return (
    <div className='tabs row fixed-bottom'>
      <div className={`col-4 tab${props.currentView === 'route' ? ' active' : ''}`} onClick={() => props.changeView('route')}>
        <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' className='bi bi-list-ol' viewBox='0 0 16 16'>
          <path fillRule='evenodd' d='M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z'/>
          <path d='M1.713 11.865v-.474H2c.217 0 .363-.137.363-.317 0-.185-.158-.31-.361-.31-.223 0-.367.152-.373.31h-.59c.016-.467.373-.787.986-.787.588-.002.954.291.957.703a.595.595 0 0 1-.492.594v.033a.615.615 0 0 1 .569.631c.003.533-.502.8-1.051.8-.656 0-1-.37-1.008-.794h.582c.008.178.186.306.422.309.254 0 .424-.145.422-.35-.002-.195-.155-.348-.414-.348h-.3zm-.004-4.699h-.604v-.035c0-.408.295-.844.958-.844.583 0 .96.326.96.756 0 .389-.257.617-.476.848l-.537.572v.03h1.054V9H1.143v-.395l.957-.99c.138-.142.293-.304.293-.508 0-.18-.147-.32-.342-.32a.33.33 0 0 0-.342.338v.041zM2.564 5h-.635V2.924h-.031l-.598.42v-.567l.629-.443h.635V5z'/>
        </svg>
        <div>路線</div>
      </div>
      <div className={`col-4 tab${props.currentView === 'station' ? ' active': ''}`} onClick={() => props.changeView('station')}>
        <div>
          {
            props.currentView !== 'station' ?
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
      <div className={`col-4 tab${props.currentView === 'about' ? ' active': ''}`} onClick={() => props.changeView('about')}>
        <div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-gear-wide-connected" viewBox="0 0 16 16">
          <path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.613.931l-.08.284a.96.96 0 0 0 1.187 1.187l.283-.081c.96-.275 1.65.918.931 1.613l-.211.205a.96.96 0 0 0 .434 1.622l.286.071c.97.243.97 1.62 0 1.864l-.286.071a.96.96 0 0 0-.434 1.622l.211.205c.719.695.03 1.888-.931 1.613l-.284-.08a.96.96 0 0 0-1.187 1.187l.081.283c.275.96-.918 1.65-1.613.931l-.205-.211a.96.96 0 0 0-1.622.434l-.071.286c-.243.97-1.62.97-1.864 0l-.071-.286a.96.96 0 0 0-1.622-.434l-.205.211c-.695.719-1.888.03-1.613-.931l.08-.284a.96.96 0 0 0-1.186-1.187l-.284.081c-.96.275-1.65-.918-.931-1.613l.211-.205a.96.96 0 0 0-.434-1.622l-.286-.071c-.97-.243-.97-1.62 0-1.864l.286-.071a.96.96 0 0 0 .434-1.622l-.211-.205c-.719-.695-.03-1.888.931-1.613l.284.08a.96.96 0 0 0 1.187-1.186l-.081-.284c-.275-.96.918-1.65 1.613-.931l.205.211a.96.96 0 0 0 1.622-.434l.071-.286zM12.973 8.5H8.25l-2.834 3.779A4.998 4.998 0 0 0 12.973 8.5zm0-1a4.998 4.998 0 0 0-7.557-3.779l2.834 3.78h4.723zM5.048 3.967c-.03.021-.058.043-.087.065l.087-.065zm-.431.355A4.984 4.984 0 0 0 3.002 8c0 1.455.622 2.765 1.615 3.678L7.375 8 4.617 4.322zm.344 7.646.087.065-.087-.065z"/>
        </svg>
        </div>
        <div>設定</div>
      </div>
      {/* <div className={`col-4 tab`}>
        <div>
          {
            props.currentView !== 'station' ?
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

function SkipWaitingNotifs(props) {
  return (
    <div className={`notifs text-center`} id='update-notifs'>
      <div className='notifs-container'>
        <p>有新版本可供更新</p>
        <ReloadButton isReloading={props.isReloading} reload={props.reload} text='重新載入'></ReloadButton>
      </div>
    </div>
  );
};

function InternetErrorNotifs(props) {
  return (
    <div className={`notifs text-center${props.networkError ? ' shown' : ''}`}>
      <div className='notifs-container'>
        <p>網路連接發生錯誤，請檢查網路</p>
      </div>
    </div>
  );
};

function ReloadButton(props) {
  if (!props.isReloading) {
    return <button className='btn reload' aria-label='Retry' onClick={props.reload}>{props.text}</button>;
  } else {
    return <p>載入中...</p>;
  }
}

export default App;