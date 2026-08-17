CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Client_Insert]
    @ClientName             VARCHAR(100)  = NULL,
    @ClientCode             VARCHAR(100)  = NULL,
    @InboundFolder          VARCHAR(MAX)  = NULL,
    @OutboundFolder         VARCHAR(MAX)  = NULL,
    @IsMergingEnabled       BIT           = 0,
    @IsActive               BIT           = 1,
    @StateColumn            VARCHAR(500)  = NULL,
    @UniqueColumns          VARCHAR(500)  = NULL,
    @IsZipExtractionEnabled BIT           = 0,
    @FileNumberColumn       VARCHAR(200)  = NULL,
    @ProjectSetupId         INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.ProVestClient
        (
            ClientName, ClientCode, InboundFolder, OutboundFolder,
            IsMergingEnabled, IsActive, StateColumn, UniqueColumns,
            IsZipExtractionEnabled, FileNumberColumn, ProjectSetupId
        )
        VALUES
        (
            @ClientName, @ClientCode, @InboundFolder, @OutboundFolder,
            @IsMergingEnabled, @IsActive, @StateColumn, @UniqueColumns,
            @IsZipExtractionEnabled, @FileNumberColumn, @ProjectSetupId
        );

        DECLARE @NewId INT = CAST(SCOPE_IDENTITY() AS INT);

        COMMIT TRANSACTION;

        SELECT @NewId AS Id;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
