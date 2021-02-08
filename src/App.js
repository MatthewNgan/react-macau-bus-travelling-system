import './App.css';
import './images/icons/blue-bus-icon.png'
import './images/icons/orange-bus-icon.png'
import React from 'react';
import RouteView from './views/RouteView.js'

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      currentView: 'route',
      networkError: false,
    }
  }

  changeView(view) {
    this.state.currentView = view;
    setTimeout(() => {
      let e = new Event('resize')
      window.dispatchEvent(e);
    },5)
  }

  handleNetworkError = () => {
    this.setState({networkError: true})
  }

  render() {
    let viewClass;
    if (this.state.currentView === 'route') viewClass = <RouteView handleNetworkError={this.handleNetworkError}></RouteView>
    return (
      <div id="app">
        {viewClass}
      </div>
    );
  }
}

export default App;
