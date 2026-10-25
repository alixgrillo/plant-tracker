export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  AddPlant: undefined;
  PlantDetail: { plantId: string };
  EditPlant: { plantId: string };
  WrongPlant: { plantId: string };
};

export type TabParamList = {
  PlantList: undefined;
  Calendar: undefined;
};
