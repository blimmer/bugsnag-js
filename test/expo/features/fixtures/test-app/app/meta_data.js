import React, { Component } from 'react'
import { View, Button } from 'react-native'
import { bugsnagClient } from './bugsnag'

export default class MetaData extends Component {
  metaDataClient = () => {
    bugsnagClient.metaData = {
      extra: {
        reason: "metaDataClientName"
      }
    }
    bugsnagClient.notify(new Error('MetaDataClientError'))
  }

  metaDataCallback = () => {
    bugsnagClient.notify(new Error('MetaDataCallbackError'), event => {
      event.metaData = {
        extra: {
          reason: "metaDataCallbackName"
        }
      }
    })
  }

  render() {
    return (
      <View>
        <Button accessibilityLabel="metaDataClientButton"
          title="metaDataClient"
          onPress={this.metaDataClient}
        />
        <Button accessibilityLabel="metaDataCallbackButton"
          title="metaDataCallback"
          onPress={this.metaDataCallback}
        />
      </View>
    )
  }
}
