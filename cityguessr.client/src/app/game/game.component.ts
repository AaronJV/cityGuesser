/// <reference types="youtube" />

import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { GameService, IRoundState, IUser } from "../game.service";
import * as Leaflet from 'leaflet';
import { fromEvent, debounceTime, interval, take } from "rxjs";


@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  public roundData?: IRoundState;
  public currentUser?: IUser;
  public map!: Leaflet.Map;
  @ViewChild('map') public mapElem?: ElementRef;
  private _player?: YT.Player;
  public playSpeed = 1;
  public marker?: Leaflet.Marker;
  private _resultMarker?: Leaflet.Marker;
  private _resultLine?: Leaflet.Polyline;
  public showSummary: boolean = false;
  public remainingTime: number = 0;


  public showBigMap: boolean = false;

  private _doubleClicks: boolean[] = [];

  constructor(public game: GameService) { }

  public ngOnInit() {
    this.game.roundState$.subscribe(s => {
      if (s.result)
      {
        this._resultMarker = new Leaflet.Marker([s.result.targetLatitude, s.result.targetLongitude], {
          icon: new Leaflet.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        });
        this._resultMarker.addTo(this.map);

        if (this.marker)
        {
          this.map.removeLayer(this.marker);
          this.marker = new Leaflet.Marker(this.marker?.getLatLng(), {
            icon: new Leaflet.Icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })
          });
          this.marker.addTo(this.map);
          this._resultLine = new Leaflet.Polyline([this._resultMarker.getLatLng(), this.marker.getLatLng()], {
            dashArray: '5'
          }).addTo(this.map);
        }
        return;
      }

      this.initMap();

      this.roundData = s;
      interval(1000).pipe(take(s.length)).subscribe((x) => this.remainingTime = s.length - x);

      if (!this._player) {
        this.initYoutube(s.video, s.videoStart);
      } else {
        this._player.loadVideoById(s.video, s.videoStart);
        this._player!.playVideo();
      }
    });
    this.game.roundStart$.subscribe(s => {
      this.initMap();

      this.roundData = s;

      this.remainingTime = 0;
      interval(1000).pipe(take(s.length)).subscribe((x) => this.remainingTime = s.length - x);

      if (!this._player) {
        this.initYoutube(s.video, s.videoStart);
      } else {
        this._player.loadVideoById(s.video, s.videoStart);
      }
      this._player!.playVideo();
    })
    this.game.roundEnd$.subscribe(s => {
      this._player?.pauseVideo();
      this.showSummary = true;
    })
    this.game.currentUser$.subscribe(u => this.currentUser = u);
  }

  public updateSpeed() {
    console.log(this.playSpeed)
    this._player?.setPlaybackRate(this.playSpeed);
  }


  public seekBack(gotoStart: boolean) {
    let time = this.roundData?.videoStart ?? 0;

    if (!gotoStart) {
      const current = this._player?.getCurrentTime() ?? 0;
      time = Math.max(time, current - 5);
    }

    this._player?.seekTo(time, true);
  }

  private initYoutube(videoId: string, start: number) {
    const tag = document.createElement('script');

    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);

    (<any>window).onYouTubeIframeAPIReady = () => {
      this._player = new YT.Player('video', {
        height: "100%",
        width: "100%",
        videoId,
        events: {
          'onReady': console.dir,
          'onStateChange': (e: any) => {
            console.log('state change');
            console.dir(e)
          }
        },
        playerVars:
        {
          autoplay: 1,
          fs: 0,
          mute: 1,
          loop: 1,
          controls: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          start,
        }
      });
    }
  }

  public initMap() {
    if (!this.mapElem) {
      return;
    }
    if (this.map) {
      this.map.fitWorld();
      if (this.marker) {
        this.map.removeLayer(this.marker);
        delete this.marker;
      }
      if (this._resultMarker) {
        this.map.removeLayer(this._resultMarker!);
        delete this._resultMarker;
      }
      if (this._resultLine)
      {
        this.map.removeLayer(this._resultLine!);
        delete this._resultLine;
      }
      return;
    }

    this.map = Leaflet.map('map');
    this.map.fitWorld();
    const google = "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=en"
    const osm = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    Leaflet.tileLayer(google, {
      maxZoom: 19,
      attribution: ''
    }).addTo(this.map);
    fromEvent<Leaflet.LeafletMouseEvent>(this.map, 'click')
      .pipe(debounceTime(200))
      .subscribe((event) => {
        if (this._doubleClicks.length === 0) {
          this.onMapClick(event);
        }
      })
    this.map.on('dblclick', () => {
      this._doubleClicks.push(true);
      setTimeout(() => {
        this._doubleClicks.pop();
      }, 250)
    });
    var resize = new ResizeObserver(() => {
      this.map.invalidateSize()
    });
    resize.observe(this.mapElem?.nativeElement)
  }

  public startGame() {
    this.game.startGame();
  }

  public onMapClick(e: Leaflet.LeafletMouseEvent) {
    if (this._resultMarker)
    {
      return;
    }

    if (this.marker) {
      this.marker.setLatLng(e.latlng);
    }
    else {
      this.marker = Leaflet.marker(e.latlng);
      this.marker.addTo(this.map);
    }
    this.game.sendGuess(e.latlng.lat, e.latlng.lng, false);
  }

  public finalizeGuess() {
    if (!this.marker) {
      return
    }

    const latLng = this.marker.getLatLng();

    this.game.sendGuess(latLng.lat, latLng.lng, true);
  }

  public swap() {
    this.showBigMap = !this.showBigMap;
    this.map.invalidateSize();
  }
}

