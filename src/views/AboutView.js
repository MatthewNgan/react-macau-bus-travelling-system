import React from 'react';
import AppData from '../AppData'

class AboutView extends React.Component {
  render() {
    return (
      <div className={`view${this.props.currentView === 'about' ? ' active' : ''}`}>
        <header className='view-header-top fixed-top row justify-content-md-center'>
          <h6 className='col-auto'>設定</h6>
        </header>
        <div className="main-about-view">
          <header>
            <img src={require('../images/icons/rounded-logo.png').default} className="logo" alt="Logo" />
            <div><div className="display-1">巴士報站</div><code className="text-muted">{AppData.appVersion}</code></div>
          </header>
          <UpdateChecker></UpdateChecker>
        </div>
      </div>
    )
  }
}

class UpdateChecker extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      latestVersion: null,
      cannotCheck: false,
    }
  }

  componentDidMount() {
    fetch('https://raw.githubusercontent.com/MatthewNgan/react-macau-bus-travelling-system/production/package.json', {cache: "no-store"})
    .then(response => response.json())
    .then(data => this.setState({latestVersion: data.version}))
    .catch(() => this.setState({cannotCheck: true}));
  }

  render() {
    if (this.state.latestVersion != null) {
      let currentMajorVersion = parseInt(AppData.appVersion.split('.')[0]);
      let currentMinorVersion = parseInt(AppData.appVersion.split('.')[1]);
      let currentUpdateVersion = parseInt(AppData.appVersion.split('.')[2]);
      let latestMajorVersion = parseInt(this.state.latestVersion.split('.')[0]);
      let latestMinorVersion = parseInt(this.state.latestVersion.split('.')[1]);
      let latestUpdateVersion = parseInt(this.state.latestVersion.split('.')[2]);
      this.atLatestVersion = true;
      if (currentMajorVersion < latestMajorVersion) {
        this.atLatestVersion = false;
      } else if (currentMajorVersion === latestMajorVersion && currentMinorVersion < latestMinorVersion) {
        this.atLatestVersion = false;
      } else if (currentMinorVersion === latestMinorVersion && currentUpdateVersion < latestUpdateVersion) {
        this.atLatestVersion = false;
      }
      if (!this.atLatestVersion) {
        console.log('not at latest version')
        setTimeout(() => document.querySelector('#update-notifs').classList.toggle('shown', true), 500);
      }
    }
    return (
      <div>
        {
          this.state.latestVersion != null ?
          (this.atLatestVersion ? '已為最新版本' : '有更新可使用!')
          : (this.state.cannotCheck ? '無法檢查更新' : '正在檢查更新...')
        }
      </div>
    )
  }
}

export default AboutView;