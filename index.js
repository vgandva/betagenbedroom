/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function () {
  var Betagen = window.Betagen;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  var mql = window.matchMedia('(max-width: 500px), (max-height: 500px)');
  var setMode = function () {
    if (mql.matches) {
      document.body.classList.remove('desktop');
      document.body.classList.add('mobile');
    } else {
      document.body.classList.remove('mobile');
      document.body.classList.add('desktop');
    }
  };
  setMode();
  mql.addListener(setMode);

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function () {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode,
    },
  };

  // Initialize viewer.
  var viewer = new Betagen.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function (sceneData) {
    var urlPrefix = 'tiles';
    var source = Betagen.ImageUrlSource.fromString(
      `${urlPrefix}/${sceneData.id}/{z}/{f}/{y}/{x}.jpg`,
      { cubeMapPreviewUrl: `${urlPrefix}/${sceneData.id}/preview.jpg` }
    );
    var geometry = new Betagen.CubeGeometry(sceneData.levels);
    var limiter = Betagen.RectilinearView.limit.traditional(
      sceneData.faceSize,
      100 * Math.PI / 180,
      120 * Math.PI / 180
    );
    var view = new Betagen.RectilinearView(
      sceneData.initialViewParameters,
      limiter
    );

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true,
    });

    // Create link hotspots.
    sceneData.linkHotspots.forEach(function (hotspot) {
      var element = createLinkHotspotElement(hotspot, view);
      scene.hotspotContainer().createHotspot(element, {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
      });
    });

    // Create info hotspots.
    sceneData.infoHotspots.forEach(function (hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
      });
    });

    return {
      data: sceneData,
      scene: scene,
      view: view,
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Betagen.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI / 2,
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function () {
      screenfull.toggle();
    });
    screenfull.on('change', function () {
      fullscreenToggleElement.classList.toggle(
        'enabled',
        screenfull.isFullscreen
      );
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function (scene) {
    var el = document.querySelector(
      `#sceneList .scene[data-id="${scene.data.id}"]`
    );
    el.addEventListener('click', function () {
      switchScene(scene);
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // Scene switching logic
  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    sceneElements.forEach(function (el) {
      el.classList.toggle('current', el.getAttribute('data-id') === scene.data.id);
    });
  }

  // Function to sanitize text
  function sanitize(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Create Link Hotspot
  function createLinkHotspotElement(hotspot, view) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'link-hotspot');

    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');
    wrapper.appendChild(icon);

    wrapper.addEventListener('click', function () {
      const zoomIn = { fov: 30, pitch: view.pitch(), yaw: view.yaw() };
      view.setParameters(zoomIn);

      setTimeout(() => {
        switchScene(findSceneById(hotspot.target));
        const zoomOut = { fov: 90, pitch: view.pitch(), yaw: view.yaw() };
        setTimeout(() => view.setParameters(zoomOut), 500);
      }, 500);
    });

    return wrapper;
  }

  function findSceneById(id) {
    return scenes.find((scene) => scene.data.id === id);
  }

  // Info Hotspot Creation
  function createInfoHotspotElement(hotspot) {
    // Implementation here.
  }

  // Other utility functions here.

})();


})();
