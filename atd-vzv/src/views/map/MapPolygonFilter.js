import React from "react";
import { Editor, EditorModes } from "react-map-gl-draw";
import ControlPanel from "./control-panel";
import { getFeatureStyle, getEditHandleStyle } from "./map-style";

const MapPolygonFilter = () => {
  const mode = EditorModes.READ_ONLY;

  const _onSelect = (options) => {
    this.setState({
      selectedFeatureIndex: options && options.selectedFeatureIndex,
    });
  };

  const _onDelete = () => {
    const selectedIndex = this.state.selectedFeatureIndex;
    if (selectedIndex !== null && selectedIndex >= 0) {
      this._editorRef.deleteFeatures(selectedIndex);
    }
  };

  const _onUpdate = ({ editType }) => {
    if (editType === "addFeature") {
      this.setState({
        mode: EditorModes.EDITING,
      });
    }
  };

  const _renderDrawTools = () => {
    // copy from mapbox
    return (
      <div className="mapboxgl-ctrl-top-left">
        <div className="mapboxgl-ctrl-group mapboxgl-ctrl">
          <button
            className="mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_polygon"
            title="Polygon tool (p)"
            onClick={() => this.setState({ mode: EditorModes.DRAW_POLYGON })}
          />
          <button
            className="mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_trash"
            title="Delete"
            onClick={_onDelete}
          />
        </div>
      </div>
    );
  };

  const _renderControlPanel = () => {
    const features = _editorRef && _editorRef.getFeatures();
    let featureIndex = this.state.selectedFeatureIndex;
    if (features && featureIndex === null) {
      featureIndex = features.length - 1;
    }
    const polygon = features && features.length ? features[featureIndex] : null;
    return (
      <ControlPanel
        containerComponent={this.props.containerComponent}
        polygon={polygon}
      />
    );
  };

  return (
    <Editor
      ref={(_) => (_editorRef = _)}
      style={{ width: "100%", height: "100%" }}
      clickRadius={12}
      mode={mode}
      onSelect={_onSelect}
      onUpdate={_onUpdate}
      editHandleShape={"circle"}
      featureStyle={getFeatureStyle}
      editHandleStyle={getEditHandleStyle}
    />
  );
};

export default MapPolygonFilter;
