CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ImportFileHeader_GetById]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    -- A duplicated id cannot identify a single row, so the edit form must not
    -- open on one. Not-found returns an empty set and the API maps that to 404.
    IF (SELECT COUNT(*) FROM dbo.ImportFileHeader WHERE id = @Id) > 1
        THROW 51002, 'ImportFileHeader.id is not unique; this row cannot be edited.', 1;

    SELECT
        h.[id],
        h.[client_id],
        h.[col_1],
        h.[col_2],
        h.[col_3],
        h.[col_4],
        h.[col_5],
        h.[col_6],
        h.[col_7],
        h.[col_8],
        h.[col_9],
        h.[col_10],
        h.[col_11],
        h.[col_12],
        h.[col_13],
        h.[col_14],
        h.[col_15],
        h.[col_16],
        h.[col_17],
        h.[col_18],
        h.[col_19],
        h.[col_20],
        h.[col_21],
        h.[col_22],
        h.[col_23],
        h.[col_24],
        h.[col_25],
        h.[col_26],
        h.[col_27],
        h.[col_28],
        h.[col_29],
        h.[col_30],
        h.[col_31],
        h.[col_32],
        h.[col_33],
        h.[col_34],
        h.[col_35],
        h.[col_36],
        h.[col_37],
        h.[col_38],
        h.[col_39],
        h.[col_40],
        h.[col_41],
        h.[col_42],
        h.[col_43],
        h.[col_44],
        h.[col_45],
        h.[col_46],
        h.[col_47],
        h.[col_48],
        h.[col_49],
        h.[col_50],
        h.[col_51],
        h.[col_52],
        h.[col_53],
        h.[col_54],
        h.[col_55],
        h.[col_56],
        h.[col_57],
        h.[col_58],
        h.[col_59],
        h.[col_60],
        h.[importer_id],
        h.[unique_key]
    FROM dbo.ImportFileHeader h
    WHERE h.id = @Id;
END
