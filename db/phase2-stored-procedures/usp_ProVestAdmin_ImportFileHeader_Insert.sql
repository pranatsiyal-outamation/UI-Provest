CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ImportFileHeader_Insert]
    @id INT = NULL,
    @client_id INT = NULL,
    @col_1 NVARCHAR(500) = NULL,
    @col_2 NVARCHAR(500) = NULL,
    @col_3 NVARCHAR(500) = NULL,
    @col_4 NVARCHAR(500) = NULL,
    @col_5 NVARCHAR(500) = NULL,
    @col_6 NVARCHAR(500) = NULL,
    @col_7 NVARCHAR(500) = NULL,
    @col_8 NVARCHAR(500) = NULL,
    @col_9 NVARCHAR(500) = NULL,
    @col_10 NVARCHAR(500) = NULL,
    @col_11 NVARCHAR(500) = NULL,
    @col_12 NVARCHAR(500) = NULL,
    @col_13 NVARCHAR(500) = NULL,
    @col_14 NVARCHAR(500) = NULL,
    @col_15 NVARCHAR(500) = NULL,
    @col_16 NVARCHAR(500) = NULL,
    @col_17 NVARCHAR(500) = NULL,
    @col_18 NVARCHAR(500) = NULL,
    @col_19 NVARCHAR(500) = NULL,
    @col_20 NVARCHAR(500) = NULL,
    @col_21 NVARCHAR(500) = NULL,
    @col_22 NVARCHAR(500) = NULL,
    @col_23 NVARCHAR(500) = NULL,
    @col_24 NVARCHAR(500) = NULL,
    @col_25 NVARCHAR(500) = NULL,
    @col_26 NVARCHAR(500) = NULL,
    @col_27 NVARCHAR(500) = NULL,
    @col_28 NVARCHAR(500) = NULL,
    @col_29 NVARCHAR(500) = NULL,
    @col_30 NVARCHAR(500) = NULL,
    @col_31 NVARCHAR(500) = NULL,
    @col_32 NVARCHAR(500) = NULL,
    @col_33 NVARCHAR(500) = NULL,
    @col_34 NVARCHAR(500) = NULL,
    @col_35 NVARCHAR(500) = NULL,
    @col_36 NVARCHAR(500) = NULL,
    @col_37 NVARCHAR(500) = NULL,
    @col_38 NVARCHAR(500) = NULL,
    @col_39 NVARCHAR(500) = NULL,
    @col_40 NVARCHAR(500) = NULL,
    @col_41 NVARCHAR(500) = NULL,
    @col_42 NVARCHAR(500) = NULL,
    @col_43 NVARCHAR(500) = NULL,
    @col_44 NVARCHAR(500) = NULL,
    @col_45 NVARCHAR(500) = NULL,
    @col_46 NVARCHAR(500) = NULL,
    @col_47 NVARCHAR(500) = NULL,
    @col_48 NVARCHAR(500) = NULL,
    @col_49 NVARCHAR(500) = NULL,
    @col_50 NVARCHAR(500) = NULL,
    @col_51 NVARCHAR(500) = NULL,
    @col_52 NVARCHAR(500) = NULL,
    @col_53 NVARCHAR(500) = NULL,
    @col_54 NVARCHAR(500) = NULL,
    @col_55 NVARCHAR(500) = NULL,
    @col_56 NVARCHAR(500) = NULL,
    @col_57 NVARCHAR(500) = NULL,
    @col_58 NVARCHAR(500) = NULL,
    @col_59 NVARCHAR(500) = NULL,
    @col_60 NVARCHAR(500) = NULL,
    @importer_id INT = NULL,
    @unique_key NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- [id] is a plain nullable int with no identity or unique constraint, so it
        -- is supplied by the caller. Refuse to create a second row with an id that
        -- already exists -- that would make both rows uneditable.
        IF @id IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.ImportFileHeader WITH (UPDLOCK, HOLDLOCK) WHERE id = @id)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51003, 'A ImportFileHeader row with that id already exists.', 1;
        END

        INSERT INTO dbo.ImportFileHeader
        (
            [id], [client_id], [col_1], [col_2], [col_3], [col_4], [col_5], [col_6], [col_7], [col_8], [col_9], [col_10], [col_11], [col_12], [col_13], [col_14], [col_15], [col_16], [col_17], [col_18], [col_19], [col_20], [col_21], [col_22], [col_23], [col_24], [col_25], [col_26], [col_27], [col_28], [col_29], [col_30], [col_31], [col_32], [col_33], [col_34], [col_35], [col_36], [col_37], [col_38], [col_39], [col_40], [col_41], [col_42], [col_43], [col_44], [col_45], [col_46], [col_47], [col_48], [col_49], [col_50], [col_51], [col_52], [col_53], [col_54], [col_55], [col_56], [col_57], [col_58], [col_59], [col_60], [importer_id], [unique_key]
        )
        VALUES
        (
            @id, @client_id, @col_1, @col_2, @col_3, @col_4, @col_5, @col_6, @col_7, @col_8, @col_9, @col_10, @col_11, @col_12, @col_13, @col_14, @col_15, @col_16, @col_17, @col_18, @col_19, @col_20, @col_21, @col_22, @col_23, @col_24, @col_25, @col_26, @col_27, @col_28, @col_29, @col_30, @col_31, @col_32, @col_33, @col_34, @col_35, @col_36, @col_37, @col_38, @col_39, @col_40, @col_41, @col_42, @col_43, @col_44, @col_45, @col_46, @col_47, @col_48, @col_49, @col_50, @col_51, @col_52, @col_53, @col_54, @col_55, @col_56, @col_57, @col_58, @col_59, @col_60, @importer_id, @unique_key
        );

        COMMIT TRANSACTION;

        SELECT @id AS id;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
