

export class ActionSetting {
  // For numeric settings, this is the step we use in the "number" input type.
  public steps?: number = 1.0;

  constructor(public name: string, public type: string, public value: any) {}
}
