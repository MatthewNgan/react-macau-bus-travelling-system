import React from 'react';

class StationView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {

    }
  }
  render() {
    return (
      <div className={`view${this.props.currentView === 'station' ? ' active' : ''}`} id='station-view'>
        <header className='view-header-top fixed-top row justify-content-md-center'>
          <h6 className='col-auto'>站點查詢</h6>
        </header>
        <div id='station-map'></div>
      </div>
    )
  }
}

export default StationView;