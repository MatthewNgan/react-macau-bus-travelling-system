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
        STATION_VIEW
      </div>
    )
  }
}

export default StationView;