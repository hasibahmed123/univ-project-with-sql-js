MySql Schema:

CUSTOMERS ( Id (PK ), Name, Table_Number, Time);
ORDERS ( Order_Id (PK), Customer_Id (FK ), Order_Item);
ORDER_ITEMS ( Order_Item_Id (PK) , Order_Id (FK), Item_Id( FK ),Quantity );
MENU_ITEMS ( Item_id (PK), Name , Description , Price);
RESERVATION ( Reservation_Id( PK), Customer_Name,Contact_Num, Special_Request );
REVIEWS ( Review_id (PK) , Customer_Id (FK)), Rating,Comment, Date );
INVENTORY ( Id (PK), Supplier_Name, Price, Date );
Contact ( Contact_Id,Phone 1, phone 2,…..);
Customers_Orders ( Customer_Orders_Id / Place_Id (PK), Id(FK) , Order_Id(FK) ) ;
Orders_Menu_Items ( Orders_Menu_Items_Id / Select_Id (PK), Order_Id (FK), Item_Id (FK) );

// Async IIFE to allow top-level await
(async () => {
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "hasibsql",
    database: "wildwestgrill",

    // local Host

const port = process.env.PORT || 5600;
