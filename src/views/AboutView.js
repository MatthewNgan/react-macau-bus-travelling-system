import React from 'react';
import AppData from '../AppData'

class AboutView extends React.Component {
    render() {
        return (
          <div className={`view${this.props.currentView === 'about' ? ' active' : ''}`}>
            <div className="main-about-view">
                <img src={require('../images/icons/rounded-logo.png').default} className="logo" alt="Logo" />
                <h1 className="display-1">巴士報站</h1><small className="version"><code className="text-muted">{AppData.appVersion}</code></small>
            </div>
          </div>
        )
    }
}

export default AboutView;