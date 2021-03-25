import React from 'react';
import AppData from '../AppData'
import PullToRefresh from 'pulltorefreshjs'
import './RouteView.css'
import RouteModal from '../modals/RouteModal'

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

  fetchDyMessage() {
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getDyMessage.html?lang=zh_tw`)
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json();
      } else {
          throw new Error('Server/Network Error: ' + response.status);
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
    });
  }

  fetchRoutes() {
    this.setState({busList: []});
    fetch(`${AppData.corsProxy}https://bis.dsat.gov.mo:37812/macauweb/getRouteAndCompanyList.html?lang=zh_tw`)
    .then(response => {
      if(response.status >= 200 && response.status < 300) {
          return response.json();
      } else {
          throw new Error('Server/Network Error: ' + response.status);
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
      document.querySelector('#route-modal .route-navbar')?.classList.toggle('stuck', false);
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
          `${this.props.isModalVisible ? 'route-shadow-shown' : ''}`
        } onClick={() => this.returnHome()}></div>
        <div id='route-main-route-view' className='view-main'>
          <div className='container'>
            {
              this.state.busList.length > 0
              ?
              <div className='row'>
                {this.state.busList.map(route => <button key={route.routeName} aria-label={`Route ${route.routeName}`} className={`bus col-md-1 col-2 btn ${route.color.toLowerCase()}`} onClick={() => this.requestRoute(route.routeName, route.color)}>{route.routeName}</button>)}
              </div>
              :
              <div className='route-loading'>
                載入中...
              </div>
            }
          </div>
        </div>
        <RouteModal mapSwitch={true} id='route-modal' route={this.route} color={this.color} shown={this.state.shouldModalBeShown} returnHome={this.returnHome} calculateTime={this.props.calculateTime} handleNetworkError={this.props.handleNetworkError}></RouteModal>
      </div>
    );
  }
}

export default RouteView;