// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TweenTarget = any;

interface ActiveTween {
  target: TweenTarget;
  property: string;
  from: number;
  to: number;
  duration: number;
  elapsed: number;
  ease: (t: number) => number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class TweenManager {
  private tweens: ActiveTween[] = [];

  to(
    target: TweenTarget,
    property: string,
    value: number,
    duration: number,
    ease?: (t: number) => number,
  ): void {
    // Replace any existing tween on same target+property
    this.tweens = this.tweens.filter(
      (tw) => !(tw.target === target && tw.property === property),
    );

    const current = target[property] as number;
    if (current === value) return;

    this.tweens.push({
      target,
      property,
      from: current,
      to: value,
      duration,
      elapsed: 0,
      ease: ease ?? easeInOutCubic,
    });
  }

  update(dt: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]!;
      tw.elapsed += dt;

      if (tw.elapsed >= tw.duration) {
        tw.target[tw.property] = tw.to;
        this.tweens.splice(i, 1);
      } else {
        const t = tw.ease(tw.elapsed / tw.duration);
        tw.target[tw.property] = tw.from + (tw.to - tw.from) * t;
      }
    }
  }

  clear(): void {
    this.tweens = [];
  }
}
