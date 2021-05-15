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
      // for testing purpose...
      // data = {'data': [{'startTime': '1970-01-01 00:00', 'expireTime': '2099-12-31 23:59', 'message': 'test message'}]}
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
          <h6 className='col header-title' style={
            {
              textAlign: 'center',
            }
          }>路線查詢</h6>
          <div className='route-options'>
            {this.state.messages.length > 0 && 
              <button className='route-info btn' id='toggleInfoBox' aria-label='Messages Button' onClick={
                () => {
                  document.querySelector('#route-info-box').classList.toggle('shown');
                }
              }>
                <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' className='bi bi-info-circle-fill' viewBox='0 0 16 16'>
                  <path fillRule='evenodd' d='M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'/>
                </svg>
              </button>
            }
          </div>
        </header>
        <div id='route-info-box' className='route-info-box modal route-modal'>
          <div className='route-header'>
            <h5>溫馨提示</h5>
          </div>
          <div className='route-info-content'>
            <ul>
              {this.state.messages.map(message => <li key={message.slice(0,2)}>{message}</li>)}
            </ul>
          </div>
        </div>
        <div id='route-main-route-view' className='view-main'>
          <div className='container'>
            {
              this.state.busList.length > 0
              ?
              <div className='row'>
                {this.state.busList.map(route => 
                  <button key={route.routeName} aria-label={`Route ${route.routeName}`} className={`bus col-md-1 col-2 btn ${route.color.toLowerCase()}`}
                  onClick={
                      () => this.props.toggleRouteModal(route.routeName,route.color.toLowerCase(),true,0,null,null,true)
                  }>
                    {
                      parseInt(route.routeChange) === 1 &&
                      <div style={{
                        padding: 1,
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '-1px',
                        left: '5px',
                        borderRadius: 5,
                        boxShadow: '2px 2px 5px 0 rgba(0, 0, 0, 0.1)'
                      }}>
                        <svg style={{
                            color: 'orangered'
                          }
                        } xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
                          <path style={{
                            color: 'orangered'
                          }} d="m9.97 4.88.953 3.811C10.159 8.878 9.14 9 8 9c-1.14 0-2.158-.122-2.923-.309L6.03 4.88C6.635 4.957 7.3 5 8 5s1.365-.043 1.97-.12zm-.245-.978L8.97.88C8.718-.13 7.282-.13 7.03.88L6.275 3.9C6.8 3.965 7.382 4 8 4c.618 0 1.2-.036 1.725-.098zm4.396 8.613a.5.5 0 0 1 .037.96l-6 2a.5.5 0 0 1-.316 0l-6-2a.5.5 0 0 1 .037-.96l2.391-.598.565-2.257c.862.212 1.964.339 3.165.339s2.303-.127 3.165-.339l.565 2.257 2.391.598z"/>
                        </svg>
                      </div>
                    }
                    {route.routeName}
                  </button>)}
              </div>
              :
              <div className='route-loading'>
                載入中...
              </div>
            }
          </div>
        </div>
      </div>
    );
  }
}

export default RouteView;