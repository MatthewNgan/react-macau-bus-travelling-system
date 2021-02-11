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
          <h6 className='col-auto'>開發中...</h6>
        </header>
        STATION_VIEW
      </div>
    )
  }
}

export default StationView;