import { Component, Input, OnChanges, SimpleChanges} from '@angular/core';

@Component({
  selector: 'app-circular-progress',
  templateUrl: './circular-progress.component.html',
  styleUrls: ['./circular-progress.component.css']
})
export class CircularProgressComponent implements OnChanges {
  @Input() public size = 35;
  @Input() public progress = 0;
  @Input() public max = 0;
  public radius = 0;
  public progCircumference = '0{px';
  public wedgeColour = '#DDDDDDAA'

  ngOnChanges(changes: SimpleChanges): void {
    const radius = (this.size/2)-5;
    const circumference = radius * Math.PI;
    const amount = this.progress / this.max;

    this.radius = radius;
    this.progCircumference = `${(1 - amount) * circumference}px ${amount * circumference}px`;

    this.wedgeColour = this.progress <= 5 ? 'rgba(252,151,0,0.64)' : '#DDDDDDAA';
  }
}
