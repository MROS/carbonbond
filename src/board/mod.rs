use std::fs;

extern crate serde_json;
use serde::{Serialize, Deserialize};
use diesel::pg::PgConnection;
use diesel::prelude::*;

use crate::db::{models, schema};
use crate::custom_error::Error;

#[derive(Deserialize, Serialize, Debug)]
pub struct Threshold {
    bond_energy: i32,
    identity: usize, // 0平民, 1黨員, 2黨代表, 3黨主席
}
#[derive(Deserialize, Serialize, Debug)]
pub struct NodeCol {
    col_name: String,
    col_type: String,
    restriction: String,
}
#[derive(Deserialize, Serialize, Debug)]
pub struct NodeTemplate {
    template_name: String,
    transfusable: bool,
    is_question: bool,
    show_in_linear_view: bool,
    rootable: bool,
    threshold_to_post: Threshold,
    attached_to: Vec<String>,
    structure: Vec<NodeCol>,
}
impl NodeTemplate {
    pub fn to_string(&self) -> String {
        serde_json::to_string(self).unwrap()
    }
}

/// 回傳剛創的板的 id
pub fn create_board(conn: &PgConnection, party_id: i32, name: &str) -> Result<i32, Error> {
    let new_board = models::NewBoard {
        board_name: name,
        ruling_party_id: party_id,
    };
    // TODO: 撞名檢查
    let board: models::Board = diesel::insert_into(schema::boards::table)
        .values(&new_board)
        .get_result(conn)
        .expect("新增看板失敗");

    let txt =
        fs::read_to_string("src/board/default_template.json").expect("讀取默認模板失敗");
    let default_templates: Vec<NodeTemplate> =
        serde_json::from_str(&txt).expect("解析默認模板失敗");
    create_node_template(conn, board.id, &default_templates);

    Ok(board.id)
}

pub fn create_node_template(
    conn: &PgConnection,
    board_id: i32,
    templates: &Vec<NodeTemplate>,
) -> Result<(), Error> {
    // TODO: 撞名檢查
    let new_template: Vec<models::NewNodeTemplate> = templates
        .into_iter()
        .map(|t| models::NewNodeTemplate {
            board_id,
            def: t.to_string(),
        })
        .collect();
    diesel::insert_into(schema::node_templates::table)
        .values(&new_template)
        .execute(conn)
        .expect("新增文章分類失敗");
    Ok(())
}
